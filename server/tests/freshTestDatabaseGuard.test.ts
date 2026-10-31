/** Phase 8 — the initial test DB migration is narrowly opt-in, never production. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFreshTestDatabaseTarget } from "../src/scripts/initFreshTestDatabase";

const base = {
  NODE_ENV: "development",
  DB_SYNCHRONIZE: "false",
  DB_NAME: "zagoquest_test",
  DB_HOST: "localhost",
  ALLOW_FRESH_TEST_SCHEMA: "true",
};

test("new test database bootstrap opts in explicitly to local zagoquest_test or ephemeral CI", () => {
  assert.doesNotThrow(() => validateFreshTestDatabaseTarget(base));
  assert.doesNotThrow(() => validateFreshTestDatabaseTarget({
    ...base, DB_NAME: "zagoquest_ci", DB_HOST: "127.0.0.1",
  }));
});

test("migration bootstrap refuses regular saves, prod, remote DB, sync or missing consent", () => {
  for (const invalid of [
    { DB_NAME: "zagoquest" },
    { DB_NAME: "production" },
    { DB_NAME: undefined },
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { DB_SYNCHRONIZE: "true" },
    { DB_SYNCHRONIZE: undefined },
    { DB_HOST: "db.production.example" },
    { DB_HOST: undefined },
    { ALLOW_FRESH_TEST_SCHEMA: "false" },
    { ALLOW_FRESH_TEST_SCHEMA: undefined },
  ]) {
    assert.throws(() => validateFreshTestDatabaseTarget({ ...base, ...invalid }), /Operação recusada/,
      JSON.stringify(invalid));
  }
});
