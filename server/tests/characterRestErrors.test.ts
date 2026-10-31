/** Phase 7 — Character REST typed error responses and private data boundaries. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { CharacterController } from "../src/api/controllers/characterController";
import { CharacterService, InvalidCharacterDataError, CharacterConflictError, CharacterAccountUnavailableError } from "../src/api/services/characterService";
import { createCharacterSchema } from "../src/shared/schemas/character.schema";

function outcome() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = { status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; } } as unknown as Response;
  return { result, res };
}
function request(body: unknown = {}, accountId = "account-a", id = accountId) {
  return { user: { id: accountId }, body, params: { accountId: id } } as unknown as Request;
}

test("Character world identifier rejects huge, blank or path-like values before SQL", () => {
  for (const world of ["", " ", "a".repeat(33), "../escape", "world/id"]) {
    assert.equal(createCharacterSchema.safeParse({ name: "Heroi", gender: "M", world }).success, false);
  }
  assert.equal(createCharacterSchema.safeParse({ name: "Heroi", gender: "M" }).success, true);
  assert.equal(createCharacterSchema.parse({ name: "Heroi", gender: "M" }).world, "main");
});

test("Character POST responds 400, 409, 401 or opaque 500 according to error category", async () => {
  const original = CharacterService.createCharacter;
  try {
    for (const [error, status, message] of [
      [new InvalidCharacterDataError("Mundo inválido"), 400, "Mundo inválido"],
      [new CharacterConflictError(), 409, "Personagem já existe."],
      [new CharacterAccountUnavailableError(), 401, "Sessão inválida."],
      [new Error("postgres://private:password@db"), 500, "Falha interna ao criar personagem."],
    ] as const) {
      CharacterService.createCharacter = (async () => { throw error; }) as typeof original;
      const { result, res } = outcome();
      await CharacterController.create(request({ name: "Heroi", gender: "M" }), res);
      assert.equal(result.status, status);
      assert.deepEqual(result.body, { error: message });
    }
  } finally { CharacterService.createCharacter = original; }
});

test("Character GET never returns SQL error details or cross-account resource list", async () => {
  const original = CharacterService.listCharacters;
  CharacterService.listCharacters = (async () => { throw new Error("postgres://private:password@db"); }) as typeof original;
  try {
    const own = outcome();
    await CharacterController.list(request(), own.res);
    assert.equal(own.result.status, 500);
    assert.deepEqual(own.result.body, { error: "Falha interna ao listar personagens." });
    const foreign = outcome();
    await CharacterController.list(request({}, "account-a", "account-b"), foreign.res);
    assert.equal(foreign.result.status, 403);
  } finally { CharacterService.listCharacters = original; }
});
