import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDatabaseRuntime } from "../src/api/databaseRuntime";

test("schema synchronization defaults OFF in every environment", () => {
  assert.equal(resolveDatabaseRuntime({}).synchronize, false);
  assert.equal(resolveDatabaseRuntime({ NODE_ENV: "production" }).synchronize, false);
  assert.equal(resolveDatabaseRuntime({ NODE_ENV: "development" }).synchronize, false);
  assert.equal(resolveDatabaseRuntime({ NODE_ENV: "test" }).synchronize, false);
});

test("explicit development opt-in enables sync, never in test or production", () => {
  assert.equal(resolveDatabaseRuntime({ NODE_ENV: "development", DB_SYNCHRONIZE: "true" }).synchronize, true);
  assert.equal(resolveDatabaseRuntime({ NODE_ENV: "test", DB_SYNCHRONIZE: "true" }).synchronize, false);
  assert.throws(() => resolveDatabaseRuntime({
    NODE_ENV: "production", DB_SYNCHRONIZE: "true",
  }), /proibido em produção/);
});

test("database logging is opt-in and ports are validated without parseInt coercion", () => {
  assert.equal(resolveDatabaseRuntime({}).logging, false);
  assert.equal(resolveDatabaseRuntime({ DB_LOGGING: "true" }).logging, true);
  assert.equal(resolveDatabaseRuntime({ DB_PORT: "6543" }).port, 6543);
  for (const value of ["0", "-1", "65536", "5432abc", "", "3.5", "Infinity"]) {
    assert.throws(() => resolveDatabaseRuntime({ DB_PORT: value }), /DB_PORT/, value);
  }
});
