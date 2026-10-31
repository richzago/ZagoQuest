/** Phase 7: REST login contract without opening a PostgreSQL connection. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { SessionController } from "../src/api/controllers/sessionContoller";
import { SessionService } from "../src/api/services/sessionService";
import { InvalidCredentialsError } from "../src/api/services/accountService";

function response() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { result, res };
}
async function submit(body: unknown) {
  const result = response();
  await SessionController.login({ body } as Request, result.res);
  return result.result;
}

test("REST login rejects malformed or oversized inputs BEFORE calling services", async () => {
  const previous = SessionService.login;
  let called = 0;
  SessionService.login = (async () => { called++; throw new Error("Unexpected DB call"); }) as typeof previous;
  try {
    for (const body of [null, {}, { email: 42, password: "abc" },
      { email: "not-an-email", password: "abc" },
      { email: "valid@example.test", password: 42 },
      { email: "valid@example.test", password: "" },
      { email: "valid@example.test", password: "x".repeat(1025) },
      { email: "valid@example.test", password: "valid", admin: true }]) {
      const result = await submit(body);
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { error: "Email ou senha inválidos." });
    }
    assert.equal(called, 0);
  } finally { SessionService.login = previous; }
});

test("REST login returns 401 generically for missing account and wrong password", async () => {
  const previous = SessionService.login;
  SessionService.login = (async () => { throw new InvalidCredentialsError(); }) as typeof previous;
  try {
    const result = await submit({ email: "valid@example.test", password: "guess" });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "Credenciais inválidas." });
  } finally { SessionService.login = previous; }
});

test("REST login hides internal PostgreSQL and signing errors behind a generic 500", async () => {
  const previous = SessionService.login;
  SessionService.login = (async () => { throw new Error("postgres://secret:password@db/test"); }) as typeof previous;
  try {
    const result = await submit({ email: "valid@example.test", password: "guess" });
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { error: "Falha interna ao autenticar." });
    assert.equal(JSON.stringify(result.body).includes("password@"), false);
  } finally { SessionService.login = previous; }
});

test("REST login preserves successful {token, accountId} Unity contract", async () => {
  const previous = SessionService.login;
  SessionService.login = (async (email, password) => {
    assert.equal(email, "valid@example.test");
    assert.equal(password, "valid");
    return { token: "jwt-token", accountId: "account-uuid" };
  }) as typeof previous;
  try {
    const result = await submit({ email: "valid@example.test", password: "valid" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { token: "jwt-token", accountId: "account-uuid" });
  } finally { SessionService.login = previous; }
});
