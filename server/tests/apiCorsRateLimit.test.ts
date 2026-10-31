/** Phase 7 — public API abuse and browser-origin protections. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { isCorsOriginAllowed } from "../src/api/middlewares/corsPolicy";
import { createIpRateLimiter } from "../src/api/middlewares/publicRateLimit";

test("production browser CORS is deny-by-default; only exact configured origins pass", () => {
  const production = { NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://play.example.test, https://admin.example.test" } as NodeJS.ProcessEnv;
  assert.equal(isCorsOriginAllowed(undefined, production), true); // Unity/native
  assert.equal(isCorsOriginAllowed("https://play.example.test", production), true);
  assert.equal(isCorsOriginAllowed("https://admin.example.test", production), true);
  for (const origin of ["https://play.example.test.evil.test", "http://play.example.test", "null", "https://other.example.test"]) {
    assert.equal(isCorsOriginAllowed(origin, production), false);
  }
  assert.equal(isCorsOriginAllowed("https://play.example.test", { NODE_ENV: "production" }), false);
  assert.equal(isCorsOriginAllowed("http://localhost:3001", { NODE_ENV: "development" }), true);
  assert.equal(isCorsOriginAllowed("http://localhost:3001", { NODE_ENV: "development", CORS_ALLOWED_ORIGINS: "http://localhost:3333" }), false);
});

test("CORS middleware sends an allow-origin header only for configured browser origins", async () => {
  const app = express();
  const env = { NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://play.example.test" } as NodeJS.ProcessEnv;
  app.use(cors({ origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin, env)) }));
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/probe`;
    const allowed = await fetch(url, { headers: { Origin: "https://play.example.test" } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://play.example.test");
    const denied = await fetch(url, { headers: { Origin: "https://evil.example.test" } });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
    assert.equal(denied.status, 200, "CORS is a browser policy, not server authorization");
    const unity = await fetch(url);
    assert.equal(unity.status, 200, "No-Origin/native clients remain supported");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("public rate limiter returns 429 + Retry-After and recovers after the window", () => {
  let time = 1000;
  const middleware = createIpRateLimiter({ maxRequests: 2, windowMs: 60_000, now: () => time });
  const request = (ip: string) => {
    const result = { status: 200, next: false, body: undefined as unknown, headers: {} as Record<string, string> };
    const req = { ip, headers: { "x-forwarded-for": "untrusted-spoof.test" } } as unknown as Request;
    const res = {
      status(code: number) { result.status = code; return this; },
      setHeader(key: string, value: string) { result.headers[key] = value; return this; },
      json(body: unknown) { result.body = body; return this; },
    } as unknown as Response;
    middleware(req, res, (() => { result.next = true; }) as NextFunction);
    return result;
  };
  assert.equal(request("127.0.0.1").next, true);
  assert.equal(request("127.0.0.1").next, true);
  const blocked = request("127.0.0.1");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.next, false);
  assert.equal(blocked.headers["Retry-After"], "60");
  assert.equal(request("127.0.0.2").next, true, "IP buckets are separate");
  time += 60_001;
  assert.equal(request("127.0.0.1").next, true);
});

test("rate limiter bounds memory and fails closed when no unexpired bucket can be reclaimed", () => {
  let time = 0;
  const middleware = createIpRateLimiter({ maxRequests: 1, windowMs: 5000, maxKeys: 1, now: () => time });
  const use = (ip: string) => {
    let status = 200;
    let continued = false;
    const res = {
      status(code: number) { status = code; return this; },
      json() { return this; },
      setHeader() { return this; },
    } as unknown as Response;
    middleware({ ip } as Request, res, (() => { continued = true; }) as NextFunction);
    return { status, continued };
  };
  assert.equal(use("a").continued, true);
  assert.equal(use("b").status, 429);
  time = 5001;
  assert.equal(use("b").continued, true);
});
