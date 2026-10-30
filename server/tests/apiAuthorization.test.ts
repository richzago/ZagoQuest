/** Authorization regressions without PostgreSQL or an HTTP listener. */
import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { authMiddleware, type AuthenticatedRequest } from "../src/api/middlewares/auth.middleware";
import { CharacterController } from "../src/api/controllers/characterController";
import { CharacterService } from "../src/api/services/characterService";

function response() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { result, res };
}

function request(accountId: string | undefined, body: unknown = {}, params: Record<string, string> = {}) {
  return { user: accountId ? { id: accountId } : undefined, body, params } as unknown as AuthenticatedRequest;
}

test("JWT middleware accepts a signed account identity and rejects absent or malformed identity", () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "api-authorization-test-secret";
  try {
    const valid = jwt.sign({ id: "account-a", email: "a@example.test" }, process.env.JWT_SECRET);
    const invalid = jwt.sign({ email: "a@example.test" }, process.env.JWT_SECRET);
    for (const [token, expectedStatus, shouldCallNext] of [
      [valid, 200, true],
      [invalid, 401, false],
      ["tampered", 401, false],
    ] as const) {
      const req = { headers: { authorization: `Bearer ${token}` } } as Request;
      const { result, res } = response();
      let nextCalled = false;
      authMiddleware(req, res, () => { nextCalled = true; });
      assert.equal(result.status, expectedStatus);
      assert.equal(nextCalled, shouldCallNext);
      if (shouldCallNext) assert.equal((req as AuthenticatedRequest).user?.id, "account-a");
    }
    const missing = response();
    authMiddleware({ headers: {} } as Request, missing.res, () => assert.fail("Must reject missing token"));
    assert.equal(missing.result.status, 401);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("POST characters only creates for the JWT account", async () => {
  const original = CharacterService.createCharacter;
  const calls: unknown[][] = [];
  CharacterService.createCharacter = (async (...args: Parameters<typeof original>) => {
    calls.push(args);
    return { id: "char-1", name: args[1] };
  }) as typeof original;
  try {
    const authorized = response();
    await CharacterController.create(request("account-a", {
      accountId: "account-a", name: "Heroi", gender: "M", world: "main",
    }), authorized.res);
    assert.equal(authorized.result.status, 201);
    assert.deepEqual(calls[0], ["account-a", "Heroi", "M", "main"]);

    const noBodyAccount = response();
    await CharacterController.create(request("account-a", {
      name: "Outra", gender: "F",
    }), noBodyAccount.res);
    assert.equal(noBodyAccount.result.status, 201);
    assert.equal(calls[1][0], "account-a");

    const forged = response();
    await CharacterController.create(request("account-a", {
      accountId: "account-b", name: "Invasor", gender: "M",
    }), forged.res);
    assert.equal(forged.result.status, 403);
    assert.equal(calls.length, 2);

    const anonymous = response();
    await CharacterController.create(request(undefined, {
      accountId: "account-b", name: "Invasor", gender: "M",
    }), anonymous.res);
    assert.equal(anonymous.result.status, 401);
    assert.equal(calls.length, 2);
  } finally {
    CharacterService.createCharacter = original;
  }
});

test("GET characters never lists characters of another JWT account", async () => {
  const original = CharacterService.listCharacters;
  const calls: string[] = [];
  CharacterService.listCharacters = (async (accountId: string) => {
    calls.push(accountId);
    return [{ name: "Heroi", gender: "M", world: "main", level: 1 }] as Awaited<ReturnType<typeof original>>;
  }) as typeof original;
  try {
    const own = response();
    await CharacterController.list(request("account-a", {}, { accountId: "account-a" }), own.res);
    assert.equal(own.result.status, 200);
    assert.deepEqual(calls, ["account-a"]);

    const other = response();
    await CharacterController.list(request("account-a", {}, { accountId: "account-b" }), other.res);
    assert.equal(other.result.status, 403);
    assert.deepEqual(calls, ["account-a"]);

    const anonymous = response();
    await CharacterController.list(request(undefined, {}, { accountId: "account-a" }), anonymous.res);
    assert.equal(anonymous.result.status, 401);
    assert.deepEqual(calls, ["account-a"]);

    const missing = response();
    await CharacterController.list(request("account-a", {}, {}), missing.res);
    assert.equal(missing.result.status, 400);
  } finally {
    CharacterService.listCharacters = original;
  }
});
