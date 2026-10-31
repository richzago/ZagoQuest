/**
 * CI-only: verifies compiled dist boot using real PostgreSQL and Tiled assets,
 * graceful SIGTERM and restored persistence. Never runs against user database.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";

if (process.env.RUN_PG_TESTS !== "true" ||
    process.env.DB_NAME !== "zagoquest_ci" ||
    process.env.NODE_ENV !== "development") {
  throw new Error("Smoke dist permitido SOMENTE no PostgreSQL descartável zagoquest_ci da CI.");
}
const cwd = process.cwd();
assert.ok(existsSync(join(cwd, "dist", "main.js")), "Execute npm run build antes do smoke.");
assert.ok(existsSync(join(cwd, "src", "data", "items", "conditions", "conditions.json")));
assert.ok(existsSync(join(cwd, "..", "assets", "maps", "test-map.json")));

const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = (portProbe.address() as { port: number }).port;
portProbe.close();
await once(portProbe, "close");

const child = spawn(process.execPath, ["dist/main.js"], {
  cwd, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, API_PORT: String(port), CHARACTER_NAME: "CiDistSmoke",
    LOG_LEVEL: "INFO", DB_SYNCHRONIZE: "true" },
});

let stdout = "";
let started = false;
let resolveBoot!: () => void;
let rejectBoot!: (reason: Error) => void;
const booted = new Promise<void>((resolve, reject) => {
  resolveBoot = resolve;
  rejectBoot = reject;
});
const onStdout = (chunk: Buffer) => {
  stdout = (stdout + chunk.toString()).slice(-20_000);
  if (!started &&
      stdout.includes("Mapa carregado do Tiled") &&
      stdout.includes("API + WebSocket na porta")) {
    started = true;
    resolveBoot();
  }
};
child.stdout.on("data", onStdout);
child.stderr.on("data", () => { /* Do not print connection secrets. */ });
child.once("error", (error) => rejectBoot(error));
child.once("exit", (code) => {
  if (!started) rejectBoot(new Error("Servidor dist terminou antes de concluir startup; exit=" + code));
});
const startupTimeout = setTimeout(
  () => rejectBoot(new Error("Timeout de startup dist com PostgreSQL/Tiled.")), 15_000,
);

let success = false;
try {
  await booted;
  // Protected route should be served by the compiled REST transport.
  const response = await fetch(
    "http://127.0.0.1:" + port + "/api/characters/account/00000000-0000-4000-8000-000000000000",
  );
  assert.equal(response.status, 401, "Rota protegida REST deve responder 401 sem JWT.");

  const closed = once(child, "exit");
  assert.equal(child.kill("SIGTERM"), true, "Falha ao sinalizar shutdown.");
  const [exitCode] = await Promise.race([
    closed,
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error("Shutdown do dist excedeu 15 segundos.")), 15_000,
    )),
  ]);
  assert.equal(exitCode, 0, "Shutdown deveria terminar sem erros.");
  assert.ok(stdout.includes("[SHUTDOWN] Finalizado com 0 erro(s)."));

  // Check character persisted after final flush, without mutating real DB.
  await AppDataSource.initialize();
  const saved = await AppDataSource.getRepository(Character).findOneBy({
    name: "CiDistSmoke",
  });
  assert.ok(saved, "Personagem de smoke não persistiu na base temporária.");
  assert.ok(Number.isSafeInteger(saved.posX) && Number.isSafeInteger(saved.posY));
  success = true;
  console.log("DIST_SMOKE_OK: compiled Node, Tiled assets, PostgreSQL, HTTP 401, SIGTERM, final save.");
} finally {
  clearTimeout(startupTimeout);
  if (child.exitCode === null) child.kill("SIGKILL");
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  if (!success) console.error("DIST_SMOKE_FAILED: examine CI job diagnostics (secrets hidden).");
}
