/** Phase 7: account registration HTTP response contract without PostgreSQL. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { AccountController } from "../src/api/controllers/accountController";
import { AccountService, InvalidAccountDataError, AccountConflictError } from "../src/api/services/accountService";

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
  await AccountController.create({ body } as Request, result.res);
  return result.result;
}

test("Account POST preserves successful {id,email} and status 201", async () => {
  const old = AccountService.createAccount;
  AccountService.createAccount = (async () => ({ id: "uuid", email: "a@example.test" })) as typeof old;
  try {
    const result = await submit({});
    assert.equal(result.status, 201);
    assert.deepEqual(result.body, { id: "uuid", email: "a@example.test" });
  } finally { AccountService.createAccount = old; }
});

test("Account POST distinguishes validation 400, duplicate 409 and hides unexpected DB 500", async () => {
  const old = AccountService.createAccount;
  const failures: Array<[Error, number, unknown]> = [
    [new InvalidAccountDataError("email: inválido"), 400, { error: "email: inválido" }],
    [new AccountConflictError(), 409, { error: "Dados de conta já cadastrados." }],
    [new Error("postgres://secret:password@db/real"), 500, { error: "Falha interna ao criar conta." }],
  ];
  try {
    for (const [error, status, body] of failures) {
      AccountService.createAccount = (async () => { throw error; }) as typeof old;
      const result = await submit({});
      assert.equal(result.status, status);
      assert.deepEqual(result.body, body);
    }
  } finally { AccountService.createAccount = old; }
});
