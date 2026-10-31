/** Phase 7 — signup payload, bcrypt byte boundary and Express JSON error contracts. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { app } from "../src/api/server";
import { createAccountSchema } from "../src/shared/schemas/account.schema";

const signup = {
  email: "person@example.test", cellphone: "+5511999999999",
  fullName: "Test Person", cpf: "52998224725", birthDate: "1990-01-01",
  password: "strong-password", confirmPassword: "strong-password", address: "Disposable Test",
};

test("Account registration enforces bounded fields and 72-byte bcrypt password, not 72 characters", () => {
  assert.equal(createAccountSchema.safeParse(signup).success, true);
  for (const password of ["short", "x".repeat(73), "é".repeat(37)]) {
    assert.equal(createAccountSchema.safeParse({ ...signup, password, confirmPassword: password }).success, false);
  }
  const exactly72 = "é".repeat(36);
  assert.equal(Buffer.byteLength(exactly72), 72);
  assert.equal(createAccountSchema.safeParse({ ...signup, password: exactly72, confirmPassword: exactly72 }).success, true);
  for (const changed of [
    { email: "x".repeat(255) + "@test.example" },
    { fullName: "X".repeat(121) },
    { address: "A".repeat(501) },
    { birthDate: "not-a-date" },
    { birthDate: "2035-01-01" },
  ]) assert.equal(createAccountSchema.safeParse({ ...signup, ...changed }).success, false);
});

test("Express REST returns JSON 400 for malformed JSON and JSON 413 for too-large bodies", async () => {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const malformed = await fetch(base + "/api/sessions", {
      method: "POST", headers: { "content-type": "application/json" }, body: '{"email":',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "JSON inválido." });
    const oversized = await fetch(base + "/api/sessions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.test", password: "x".repeat(20_000) }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: "Corpo da requisição excede 16 KB." });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
