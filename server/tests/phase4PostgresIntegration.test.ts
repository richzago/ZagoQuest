/**
 * Integração real de PostgreSQL em base DESCARTÁVEL do GitHub Actions.
 * NUNCA executar contra a base local zagoquest. Opt-in obrigatório.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { WebSocket } from "ws";
import { Account } from "../src/api/entities/Account";
import { World } from "../src/game/world/World";
import { WebSocketServer as GameWs } from "../src/network/websocket/wsServer";
import { authorizeCharacterSession } from "../src/network/auth/characterSessionAuth";
import { listenHttp, closeHttp } from "../src/game/core/httpLifecycle";
import { before, after, test } from "node:test";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";
import { Guild } from "../src/api/entities/Guild";
import { GuildMember } from "../src/api/entities/GuildMember";
import { GuildService } from "../src/api/services/guildService";
import { DatabasePersistence } from "../src/game/systems/databasePersistence";
import { OnlinePlayerDirectory } from "../src/game/systems/onlinePlayerDirectory";
import { Player } from "../src/game/entities/player";

if (process.env.RUN_PG_TESTS !== "true" ||
    process.env.DB_NAME !== "zagoquest_ci" ||
    process.env.NODE_ENV !== "development") {
  throw new Error("Teste de PostgreSQL só pode rodar com RUN_PG_TESTS=true, DB_NAME=zagoquest_ci e NODE_ENV=development.");
}

let counter = 0;
async function fixture(gold: number) {
  const name = `CiPlayer${++counter}`;
  const repo = AppDataSource.getRepository(Character);
  const row = await repo.save(repo.create({
    name, gender: "M", level: 101, xp: 0, gold, bankGold: 500,
    inventory: {}, equipment: {}, skills: {},
  }));
  return row;
}

before(async () => {
  assert.equal(AppDataSource.options.synchronize, true, "Schema sync só é aceito nesta base descartável de CI.");
  await AppDataSource.initialize();
});
after(async () => {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
});

test("PostgreSQL real: gold online prevalece sobre saldo SQL antigo e autosave não reverte cobrança", async () => {
  const row = await fixture(1_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 32_000; p.bankGold = 500;
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await GuildService.createGuild(row.name, "Primeira", "Integração real");
    assert.equal(p.gold, 12_000);
    const charged = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(charged.gold, 12_000);
    await DatabasePersistence.saveCharacter(p);
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 12_000);
    assert.equal(saved.bankGold, 500);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
  } finally { cleanup(); }
});

test("PostgreSQL real: personagem offline perde taxa exatamente uma vez", async () => {
  const row = await fixture(40_000);
  await GuildService.createGuild(row.name, "Segunda", "Integração real offline");
  const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
  assert.equal(saved.gold, 20_000);
  assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
});

test("PostgreSQL real: falha de INSERT no membro provoca ROLLBACK de gold e guilda", async () => {
  const row = await fixture(25_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 25_000;
  await AppDataSource.query(`
    CREATE FUNCTION ci_abort_member_insert() RETURNS trigger AS $ci$
      BEGIN RAISE EXCEPTION 'ci injected member failure'; RETURN NEW; END;
    $ci$ LANGUAGE plpgsql
  `);
  await AppDataSource.query(`
    CREATE TRIGGER ci_block_member BEFORE INSERT ON guild_members
    FOR EACH ROW EXECUTE FUNCTION ci_abort_member_insert()
  `);
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await assert.rejects(
      GuildService.createGuild(row.name, "Terceira", "Rollback real"),
      /ci injected member failure/,
    );
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 25_000);
    assert.equal(p.gold, 25_000);
    assert.equal(await AppDataSource.getRepository(Guild).count({ where: { name: "Terceira" } }), 0);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 0);
  } finally {
    cleanup();
    await AppDataSource.query("DROP TRIGGER IF EXISTS ci_block_member ON guild_members");
    await AppDataSource.query("DROP FUNCTION IF EXISTS ci_abort_member_insert()");
  }
});

test("PostgreSQL real: chamadas concorrentes não cobram duas vezes", async () => {
  const row = await fixture(55_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 55_000;
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    const result = await Promise.allSettled([
      GuildService.createGuild(row.name, "Quarta", "Uma criação"),
      GuildService.createGuild(row.name, "Quinta", "Outra criação"),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(result.filter((r) => r.status === "rejected").length, 1);
    assert.equal(p.gold, 35_000);
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 35_000);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
  } finally { cleanup(); }
});

test("PostgreSQL real: sessão WebSocket JWT de duas contas, rejeição cruzada e persistência no logout", async () => {
  const accountRepo = AppDataSource.getRepository(Account);
  const accountA = await accountRepo.save(accountRepo.create({
    email: "ci-phase5-a@example.test", cellphone: "00000000001",
    fullName: "CI Account A", cpf: "00000000001", birthDate: "1990-01-01",
    passwordHash: "ci-not-real", address: "Disposable CI",
  }));
  const accountB = await accountRepo.save(accountRepo.create({
    email: "ci-phase5-b@example.test", cellphone: "00000000002",
    fullName: "CI Account B", cpf: "00000000002", birthDate: "1990-01-01",
    passwordHash: "ci-not-real", address: "Disposable CI",
  }));
  const a = await fixture(300);
  const b = await fixture(500);
  const repo = AppDataSource.getRepository(Character);
  await repo.update({ id: a.id }, { accountId: accountA.id });
  await repo.update({ id: b.id }, { accountId: accountB.id });

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "ci-phase5-jwt-secret-not-for-production";
  const tokenA = jwt.sign({ id: accountA.id }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const tokenB = jwt.sign({ id: accountB.id }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const http = createServer();
  const world = new World();
  world.generateMap(16, 16);
  const game = new GameWs(http, world, { authRequired: true });
  const sockets: WebSocket[] = [];
  const authenticated = (ws: WebSocket): Promise<{ characterId: string }> => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout esperando authenticated")), 4000);
    const receive = (raw: WebSocket.RawData) => {
      const packet = JSON.parse(raw.toString());
      if (packet.type !== "authenticated") return;
      clearTimeout(timeout);
      ws.off("message", receive);
      resolve(packet);
    };
    ws.on("message", receive);
  });
  try {
    await listenHttp(http, 0);
    const connect = async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${(http.address() as AddressInfo).port}`);
      sockets.push(ws);
      await once(ws, "open");
      return ws;
    };
    const first = await connect();
    const firstAck = authenticated(first);
    first.send(JSON.stringify({ type: "authenticate", token: tokenA, characterId: a.id }));
    assert.equal((await firstAck).characterId, a.id);

    const second = await connect();
    const secondAck = authenticated(second);
    second.send(JSON.stringify({ type: "authenticate", token: tokenB, characterId: b.id }));
    assert.equal((await secondAck).characterId, b.id);

    const foreign = await connect();
    const closed = once(foreign, "close");
    foreign.send(JSON.stringify({ type: "authenticate", token: tokenA, characterId: b.id }));
    const [code] = await closed;
    assert.equal(code, 1008);
    assert.equal(game.getBroadcastService().getClients().size, 2);

    // Outro jogador pode nascer num tile alternativo quando o inicial já está ocupado.
    const otherStartX = world.players.find(p => p.id === b.id)!.position.x;
    first.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    for (let tries = 0; tries < 120 && world.players.find(p => p.id === a.id)?.position.x !== 1; tries++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(world.players.find(p => p.id === a.id)?.position.x, 1);
    assert.equal(world.players.find(p => p.id === b.id)?.position.x, otherStartX);

    await game.close();
    const reloaded = await repo.findOneByOrFail({ id: a.id });
    assert.equal(reloaded.posX, 1, "logout/shutdown must flush position");
    assert.equal((await repo.findOneByOrFail({ id: b.id })).posX, otherStartX);
  } finally {
    for (const ws of sockets) if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
    await game.close();
    await closeHttp(http);
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});


test("Fase 7 PostgreSQL + HTTP REST: login, JWT, propriedade de Character e negativas", async () => {
  const bcrypt = (await import("bcrypt")).default;
  const { startApi } = await import("../src/api/server");
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "phase7-ci-rest-jwt-secret-not-for-production";
  const accounts = AppDataSource.getRepository(Account);
  const password = "phase7-ci-password";
  const passwordHash = await bcrypt.hash(password, 10);
  const a = await accounts.save(accounts.create({
    email: "ci-rest-a@example.test", cellphone: "00000000101", fullName: "CI REST Account A",
    cpf: "00000000101", birthDate: "1990-01-01", passwordHash, address: "Disposable CI",
  }));
  const b = await accounts.save(accounts.create({
    email: "ci-rest-b@example.test", cellphone: "00000000102", fullName: "CI REST Account B",
    cpf: "00000000102", birthDate: "1990-01-01", passwordHash, address: "Disposable CI",
  }));

  let http: Awaited<ReturnType<typeof startApi>> | undefined;
  try {
    http = await startApi();
    await listenHttp(http, 0);
    const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown, token?: string) => fetch(url + route, {
      method: "POST",
      headers: { "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

    const loginA = await post("/api/sessions", { email: a.email, password });
    assert.equal(loginA.status, 200);
    const sessionA = await loginA.json() as { token: string; accountId: string };
    assert.equal(sessionA.accountId, a.id);
    assert.equal((jwt.verify(sessionA.token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as jwt.JwtPayload).id, a.id);

    const loginB = await post("/api/sessions", { email: b.email, password });
    assert.equal(loginB.status, 200);
    const sessionB = await loginB.json() as { token: string; accountId: string };

    const wrong = await post("/api/sessions", { email: a.email, password: "incorrect" });
    const unknown = await post("/api/sessions", { email: "missing-rest@example.test", password });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await wrong.json(), await unknown.json(), "Login must not disclose account existence");
    assert.equal((await post("/api/sessions", { email: a.email, password: 10 })).status, 400);

    const own = await post("/api/characters", { name: "Resthero", gender: "M", world: "main" }, sessionA.token);
    assert.equal(own.status, 201);
    const character = await own.json() as { id: string; name: string };
    assert.equal(character.name, "Resthero");

    const forged = await post("/api/characters", {
      accountId: a.id, name: "Stolenhero", gender: "F",
    }, sessionB.token);
    assert.equal(forged.status, 403);
    const missingAuth = await post("/api/characters", { name: "Anonymous", gender: "M" });
    assert.equal(missingAuth.status, 401);

    const listed = await fetch(url + "/api/characters/account/" + a.id, {
      headers: { authorization: `Bearer ${sessionA.token}` },
    });
    assert.equal(listed.status, 200);
    const characters = await listed.json() as Array<{ id: string }>;
    assert.equal(characters.some(entry => entry.id === character.id), true);

    const foreign = await fetch(url + "/api/characters/account/" + a.id, {
      headers: { authorization: `Bearer ${sessionB.token}` },
    });
    assert.equal(foreign.status, 403);

    const expired = jwt.sign({ id: a.id }, process.env.JWT_SECRET!, {
      algorithm: "HS256", expiresIn: -1,
    });
    const expiredResponse = await fetch(url + "/api/characters/account/" + a.id, {
      headers: { authorization: `Bearer ${expired}` },
    });
    assert.equal(expiredResponse.status, 401);

    const differentAlg = jwt.sign({ id: a.id }, process.env.JWT_SECRET!, { algorithm: "HS384" });
    const differentAlgResponse = await fetch(url + "/api/characters/account/" + a.id, {
      headers: { authorization: `Bearer ${differentAlg}` },
    });
    assert.equal(differentAlgResponse.status, 401);
  } finally {
    if (http) await closeHttp(http);
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  }
});


test("Fase 7 PostgreSQL + HTTP: guildas paginadas com limite, erro 400 e dados públicos", async () => {
  const { startApi } = await import("../src/api/server");
  const http = await startApi();
  try {
    await listenHttp(http, 0);
    const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    for (const path of ["/api/guilds/list", "/api/guilds/rank/level", "/api/guilds/rank/kills"]) {
      const valid = await fetch(base + path + "?page=1&limit=2");
      assert.equal(valid.status, 200);
      const body = await valid.json() as { page: number; limit: number; total: number; data: unknown[] };
      assert.equal(body.page, 1);
      assert.equal(body.limit, 2);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length <= 2);
      for (const malformed of ["?page=0", "?page=-1", "?page=1abc", "?limit=101", "?limit=0", "?page=1&page=2"]) {
        const invalid = await fetch(base + path + malformed);
        assert.equal(invalid.status, 400, `Expected invalid pagination on ${path + malformed}`);
      }
    }
  } finally {
    await closeHttp(http);
  }
});
