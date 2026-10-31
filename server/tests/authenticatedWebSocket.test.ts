/** Fase 5: WebSocket REAL em porta aleatória + dois personagens, sem PostgreSQL. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { WebSocketServer as GameWs } from "../src/network/websocket/wsServer";
import type { AuthorizedCharacter } from "../src/network/auth/characterSessionAuth";
import type { WebSocketSessionOptions } from "../src/network/websocket/wsServer";
import { closeHttp, listenHttp } from "../src/game/core/httpLifecycle";

const A = "550e8400-e29b-41d4-a716-446655440001";
const B = "550e8400-e29b-41d4-a716-446655440002";
type Packet = { type: string; [key: string]: unknown };
function eventually(predicate: () => boolean, delay = 1200): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) resolve();
      else if (Date.now() - started > delay) reject(new Error("timeout de condição no socket"));
      else setTimeout(poll, 10);
    };
    poll();
  });
}
async function fixture(options: WebSocketSessionOptions = {}) {
  const server: Server = createServer();
  const world = new World();
  world.generateMap(16, 16);
  const players = new Map([
    [A, new Player(A, "Alice", 2, 2)],
    [B, new Player(B, "Bruno", 4, 4)],
  ]);
  const saved: Array<{ id: string; x: number; y: number }> = [];
  const game = new GameWs(server, world, {
    authRequired: true,
    authorize: async (token, characterId): Promise<AuthorizedCharacter | null> => {
      const owned = token === "token-a" ? A : token === "token-b" ? B : undefined;
      if (!owned || owned !== characterId) return null;
      return { accountId: "account-" + owned, characterId, characterName: players.get(owned)!.name };
    },
    loadPlayer: async (identity) => players.get(identity.characterId) ?? null,
    savePlayer: async (player) => { saved.push({ id: player.id, x: player.position.x, y: player.position.y }); },
    ...options,
  });
  await listenHttp(server, 0);
  const sockets: WebSocket[] = [];
  const packets = new Map<WebSocket, Packet[]>();
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}`);
    const inbox: Packet[] = [];
    ws.on("message", (data) => {
      try { inbox.push(JSON.parse(data.toString()) as Packet); } catch { /* binary test */ }
    });
    packets.set(ws, inbox);
    sockets.push(ws);
    await once(ws, "open");
    return ws;
  }
  function auth(ws: WebSocket, token: string, characterId: string) {
    ws.send(JSON.stringify({ type: "authenticate", token, characterId }));
  }
  async function waitPacket(ws: WebSocket, type: string) {
    await eventually(() => (packets.get(ws) ?? []).some((p) => p.type === type));
    return packets.get(ws)!.find((p) => p.type === type)!;
  }
  async function close() {
    for (const ws of sockets) if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
    await game.close();
    await closeHttp(server);
  }
  return { game, world, players, saved, packets, auth, connect, waitPacket, close };
}

test("socket anônimo não recebe snapshot e não consegue mover; identidade errada recusada", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    assert.equal(f.packets.get(ws)!.length, 0);
    const closed = once(ws, "close");
    ws.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    const [code] = await closed;
    assert.equal(code, 1008);
    assert.equal(f.players.get(A)!.position.x, 2);
    const foreign = await f.connect();
    const foreignClosed = once(foreign, "close");
    f.auth(foreign, "token-a", B);
    const [foreignCode] = await foreignClosed;
    assert.equal(foreignCode, 1008);
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
  } finally { await f.close(); }
});

test("duas contas distintas movem só o próprio avatar; veem spawn/move do outro", async () => {
  const f = await fixture();
  try {
    const alice = await f.connect();
    f.auth(alice, "token-a", A);
    await f.waitPacket(alice, "authenticated");
    const bruno = await f.connect();
    f.auth(bruno, "token-b", B);
    await f.waitPacket(bruno, "authenticated");
    await eventually(() => f.packets.get(alice)!.some((p) => p.type === "spawn" && p.id === B));
    await eventually(() => f.packets.get(bruno)!.some((p) => p.type === "spawn" && p.id === A));
    const snapshot = f.packets.get(bruno)!.filter((p) => p.type === "spawn" && p.id === A);
    assert.equal(snapshot.length, 1);
    assert.equal(f.world.players.length, 2);
    alice.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    await eventually(() => f.players.get(A)!.position.x === 3);
    await eventually(() => f.packets.get(bruno)!.some((p) => p.type === "move" && p.id === A));
    assert.deepEqual(f.players.get(B)!.position, { x: 4, y: 4 });
  } finally { await f.close(); }
});

test("dois sockets não podem controlar o mesmo UUID", async () => {
  const f = await fixture();
  try {
    const first = await f.connect();
    f.auth(first, "token-a", A);
    await f.waitPacket(first, "authenticated");
    const second = await f.connect();
    const closed = once(second, "close");
    f.auth(second, "token-a", A);
    const [code] = await closed;
    assert.equal(code, 1008);
    assert.equal(f.game.getBroadcastService().getClients().size, 1);
  } finally { await f.close(); }
});

test("logout bloqueia comandos, salva player, despawna e permite reconexão", async () => {
  const f = await fixture();
  try {
    const alice = await f.connect(), bruno = await f.connect();
    f.auth(alice, "token-a", A);
    f.auth(bruno, "token-b", B);
    await Promise.all([f.waitPacket(alice, "authenticated"), f.waitPacket(bruno, "authenticated")]);
    alice.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    await eventually(() => f.players.get(A)!.position.x === 3);
    const closed = once(alice, "close");
    alice.close(); await closed;
    await eventually(() => f.saved.some((s) => s.id === A && s.x === 3));
    await eventually(() => f.packets.get(bruno)!.some((p) => p.type === "despawn" && p.id === A));
    const reconnect = await f.connect();
    f.auth(reconnect, "token-a", A);
    await f.waitPacket(reconnect, "authenticated");
    await eventually(() => f.packets.get(reconnect)!.some((p) => p.type === "spawn" && p.id === B));
    assert.equal(f.world.players.length, 2);
    assert.equal(f.players.get(A)!.position.x, 3);
  } finally { await f.close(); }
});

test("shutdown drena gravações finais de duas sessões autenticadas", async () => {
  const f = await fixture();
  const a = await f.connect(), b = await f.connect();
  try {
    f.auth(a, "token-a", A);
    f.auth(b, "token-b", B);
    await Promise.all([f.waitPacket(a, "authenticated"), f.waitPacket(b, "authenticated")]);
    await f.game.close();
    assert.equal(f.saved.filter(s => s.id === A).length, 1);
    assert.equal(f.saved.filter(s => s.id === B).length, 1);
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
  } finally { await f.close(); }
});

test("duas autenticações simultâneas do mesmo UUID permitem apenas um controlador", async () => {
  const f = await fixture();
  try {
    const first = await f.connect(), second = await f.connect();
    const closeFirst = new Promise<number>((resolve) => first.once("close", (code) => resolve(code)));
    const closeSecond = new Promise<number>((resolve) => second.once("close", (code) => resolve(code)));
    f.auth(first, "token-a", A);
    f.auth(second, "token-a", A);
    await eventually(() => [...f.packets.values()].filter(p => p.some(x => x.type === "authenticated")).length === 1);
    await eventually(() => first.readyState === WebSocket.CLOSED || second.readyState === WebSocket.CLOSED);
    if (first.readyState === WebSocket.CLOSED) assert.equal(await closeFirst, 1008);
    else assert.equal(await closeSecond, 1008);
    assert.equal(f.game.getBroadcastService().getClients().size, 1);
    assert.equal(f.world.players.filter(p => p.id === A).length, 1);
  } finally { await f.close(); }
});

test("pacote authenticate com campos extras e UUID malformado é rejeitado sem criar sessão", async () => {
  const f = await fixture();
  try {
    const extra = await f.connect();
    const closingExtra = once(extra, "close");
    extra.send(JSON.stringify({ type: "authenticate", token: "token-a", characterId: A, role: "admin" }));
    assert.equal((await closingExtra)[0], 1008);

    const malformed = await f.connect();
    const closingMalformed = once(malformed, "close");
    malformed.send(JSON.stringify({ type: "authenticate", token: "token-a", characterId: "not-uuid" }));
    assert.equal((await closingMalformed)[0], 1008);
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
  } finally { await f.close(); }
});

test("requisição de autenticação pendente não aceita comandos em paralelo, mesmo com token válido", async () => {
  let release!: () => void;
  const f = await fixture({
    authorize: async (_token, characterId) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { accountId: "account-a", characterId, characterName: "Alice" };
    },
  });
  try {
    const ws = await f.connect();
    const closing = once(ws, "close");
    f.auth(ws, "token-a", A);
    ws.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    assert.equal((await closing)[0], 1008);
    assert.equal(f.players.get(A)!.position.x, 2);
    release();
    await new Promise(r => setTimeout(r, 30));
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
  } finally {
    if (release) release();
    await f.close();
  }
});

test("pacote maior que MAX_PACKET_BYTES cai antes de autenticar", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    const closing = once(ws, "close");
    ws.send("x".repeat(9000));
    assert.equal((await closing)[0], 1009);
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
  } finally { await f.close(); }
});

test("gold privado vai só ao socket autenticado do UUID correto", async () => {
  const f = await fixture();
  try {
    const a = await f.connect(), b = await f.connect();
    f.auth(a, "token-a", A);
    f.auth(b, "token-b", B);
    await Promise.all([f.waitPacket(a, "authenticated"), f.waitPacket(b, "authenticated")]);
    f.game.sendToPlayer(A, JSON.stringify({ type: "gold", gold: 12345 }));
    await eventually(() => f.packets.get(a)!.some(p => p.type === "gold" && p.gold === 12345));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(f.packets.get(b)!.some(p => p.type === "gold" && p.gold === 12345), false);
  } finally { await f.close(); }
});

test("a reconexão aguarda persistência final e evita sobrescrever estado de jogador online", async () => {
  let releaseSave!: () => void;
  let savePending = false;
  const f = await fixture({
    savePlayer: async () => {
      savePending = true;
      await new Promise<void>(resolve => { releaseSave = resolve; });
    },
  });
  try {
    const first = await f.connect();
    f.auth(first, "token-a", A);
    await f.waitPacket(first, "authenticated");
    const closed = once(first, "close");
    first.close();
    await closed;
    await eventually(() => savePending);
    const retry = await f.connect();
    const rejected = once(retry, "close");
    f.auth(retry, "token-a", A);
    assert.equal((await rejected)[0], 1008);
    releaseSave();
    await eventually(() => f.game.getBroadcastService().getClients().size === 0);
    await new Promise(resolve => setTimeout(resolve, 30));
    const next = await f.connect();
    f.auth(next, "token-a", A);
    await f.waitPacket(next, "authenticated");
    assert.equal(f.world.players.filter(p => p.id === A).length, 1);
  } finally {
    if (releaseSave) releaseSave();
    await f.close();
  }
});
