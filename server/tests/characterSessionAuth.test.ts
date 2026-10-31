/** Fase 5: authorization helper contract without opening a WebSocket. */
import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";
import { authorizeCharacterSession } from "../src/network/auth/characterSessionAuth";

const ACCOUNT_A = "550e8400-e29b-41d4-a716-446655440001";
const ACCOUNT_B = "550e8400-e29b-41d4-a716-446655440002";
const CHARACTER_A = "550e8400-e29b-41d4-a716-446655440003";

async function fixture(action: (sign: (account: string, expires?: number) => string) => Promise<void>) {
  const previousSecret = process.env.JWT_SECRET;
  const source = AppDataSource as unknown as { getRepository: unknown };
  const oldRepository = source.getRepository;
  process.env.JWT_SECRET = "phase5-test-secret-never-use-in-production";
  source.getRepository = (entity: unknown) => {
    assert.equal(entity, Character);
    return {
      async findOne(query: { where: { id: string; accountId: string }; select: Record<string, boolean> }) {
        assert.deepEqual(query.select, { id: true, name: true, accountId: true });
        if (query.where.id === CHARACTER_A && query.where.accountId === ACCOUNT_A) {
          return { id: CHARACTER_A, name: "Owned", accountId: ACCOUNT_A };
        }
        return null;
      },
    };
  };
  const sign = (account: string, expires = 3600) => jwt.sign(
    { id: account, email: "fake@example.test" },
    process.env.JWT_SECRET!, { expiresIn: expires },
  );
  try { await action(sign); }
  finally {
    source.getRepository = oldRepository;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
}

test("JWT válido e personagem da conta A autoriza sessão por UUID", async () => {
  await fixture(async (sign) => {
    assert.deepEqual(await authorizeCharacterSession(sign(ACCOUNT_A), CHARACTER_A), {
      accountId: ACCOUNT_A,
      characterId: CHARACTER_A,
      characterName: "Owned",
    });
  });
});

test("JWT válido de conta B NÃO controla personagem da conta A", async () => {
  await fixture(async (sign) => {
    assert.equal(await authorizeCharacterSession(sign(ACCOUNT_B), CHARACTER_A), null);
  });
});

test("sem token, UUID inválido, payload sem identidade e token expirado rejeitados", async () => {
  await fixture(async (sign) => {
    const valid = sign(ACCOUNT_A);
    assert.equal(await authorizeCharacterSession(null, CHARACTER_A), null);
    assert.equal(await authorizeCharacterSession(valid, "Owned"), null);
    assert.equal(await authorizeCharacterSession(valid, ""), null);
    assert.equal(await authorizeCharacterSession(valid, CHARACTER_A + "x"), null);
    assert.equal(await authorizeCharacterSession(valid + "x", CHARACTER_A), null);
    assert.equal(await authorizeCharacterSession(sign(ACCOUNT_A, -5), CHARACTER_A), null);
    assert.equal(await authorizeCharacterSession(
      jwt.sign({ email: "missing-id" }, process.env.JWT_SECRET!), CHARACTER_A,
    ), null);
  });
});

test("falha de conexão com PostgreSQL NÃO é interpretada como autorização aceita", async () => {
  await fixture(async (sign) => {
    const source = AppDataSource as unknown as { getRepository: unknown };
    const previous = source.getRepository;
    source.getRepository = () => ({
      findOne: async () => { throw new Error("PostgreSQL offline"); },
    });
    try {
      await assert.rejects(
        authorizeCharacterSession(sign(ACCOUNT_A), CHARACTER_A),
        /PostgreSQL offline/,
      );
    } finally { source.getRepository = previous; }
  });
});
