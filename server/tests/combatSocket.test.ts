/**
 * Integração REAL: HTTP + WebSocket + Zod + handlers + EventBridge.
 * Testes garantem que o Unity recebe apenas um pacote de cada evento.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket, type WebSocketServer as NodeWsServer } from "ws";
import { WebSocketServer as GameWs } from "../src/network/websocket/wsServer";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { CombatSystem } from "../src/game/combat/combatSystem";
import { PlayerAttackSystem } from "../src/game/combat/playerAttackSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const type: MonsterType = {
  id: "socket-combat-monster",
  name: "CombatMonster",
  level: 1,
  stats: { hp: 100 },
  combat: { xp: 4, damageMin: 1, damageMax: 2 },
  loot: [],
  ai: { type: "passive" },
  visual: { symbol: "M" },
};
interface Fixture {
  player: Player;
  monster: Monster;
  world: World;
  open(): Promise<{ socket: WebSocket; messages: Record<string, unknown>[] }>;
  close(): Promise<void>;
}

async function fixture(): Promise<Fixture> {
  const server: Server = createServer();
  const world = new World();
  world.generateMap(15, 15);
  const player = new Player("player-test", "NetworkFighter", 2, 2);
  player.attack = 15;
  const monster = new Monster("monster-test", type, 3, 2, new MonsterAI(), 2, 60_000);
  world.addPlayer(player);
  world.addMonster(monster);

  const gameWs = new GameWs(server, world);
  const sockets: WebSocket[] = [];
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    player, monster, world,
    async open() {
      const socket = new WebSocket(`ws://127.0.0.1:${port}`);
      sockets.push(socket);
      const messages: Record<string, unknown>[] = [];
      socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
      await once(socket, "open");
      return { socket, messages };
    },
    async close() {
      for (const socket of sockets) if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      const wss = (gameWs as unknown as {wss: NodeWsServer}).wss;
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function nextPacket(
  socket: WebSocket,
  type: string,
  condition: (packet: Record<string, unknown>) => boolean = () => true,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Aguardando ${type}`)); }, 3000);
    const onMessage = (data: WebSocket.RawData) => {
      const packet = JSON.parse(data.toString()) as Record<string, unknown>;
      if (packet.type !== type || !condition(packet)) return;
      cleanup();
      resolve(packet);
    };
    const cleanup = () => { clearTimeout(timer); socket.off("message", onMessage); };
    socket.on("message", onMessage);
  });
}
function packets(messages: Record<string, unknown>[], type: string): Record<string, unknown>[] {
  return messages.filter((message) => message.type === type);
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("WebSocket manual: um ataque produz exatamente um pacote damage", async () => {
  const f = await fixture();
  try {
    const { socket, messages } = await f.open();
    const damaged = nextPacket(socket, "damage");
    socket.send(JSON.stringify({ type: "attack", targetId: f.monster.id }));
    const packet = await damaged;
    await settle();
    assert.equal(packet.targetId, f.monster.id);
    assert.equal(packets(messages, "damage").length, 1);
    assert.equal(packets(messages, "monsterDied").length, 0);
  } finally { await f.close(); }
});

test("WebSocket: ataque em cooldown é recusado sem damage extra", async () => {
  const f = await fixture();
  try {
    const { socket, messages } = await f.open();
    const damaged = nextPacket(socket, "damage");
    socket.send(JSON.stringify({ type: "attack", targetId: f.monster.id }));
    await damaged;
    const failed = nextPacket(socket, "attackFailed");
    socket.send(JSON.stringify({ type: "attack", targetId: f.monster.id }));
    const packet = await failed;
    await settle();
    assert.equal(packet.reason, "Ataque em cooldown");
    assert.equal(packets(messages, "damage").length, 1);
  } finally { await f.close(); }
});

test("WebSocket: morte envia um damage, um monsterDied e um despawn", async (t) => {
  const f = await fixture();
  try {
    const { socket, messages } = await f.open();
    // Controla os timers do corpo/respawn depois do handshake.
    t.mock.timers.enable({ apis: ["setTimeout"] });
    f.monster.hp = 1;
    const despawn = nextPacket(socket, "despawn", (m) => m.id === f.monster.id);
    socket.send(JSON.stringify({ type: "attack", targetId: f.monster.id }));
    await despawn;
    await settle();
    assert.equal(packets(messages, "damage").length, 1);
    assert.equal(packets(messages, "monsterDied").length, 1);
    assert.equal(packets(messages, "despawn").filter((m) => m.id === f.monster.id).length, 1);
    assert.equal(f.world.corpses.length, 1);
    assert.equal(f.player.experience, 4);
    assert.deepEqual(
      messages.filter((m) => ["damage", "monsterDied", "despawn"].includes(String(m.type))).map((m) => m.type),
      ["damage", "monsterDied", "despawn"],
    );
  } finally { t.mock.timers.reset(); await f.close(); }
});

test("WebSocket: ataque automático também utiliza a mesma ponte de eventos", async () => {
  const f = await fixture();
  try {
    const { socket, messages } = await f.open();
    const start = nextPacket(socket, "autoAttackStarted");
    socket.send(JSON.stringify({ type: "startAutoAttack", targetId: f.monster.id }));
    assert.equal((await start).targetId, f.monster.id);
    const damaged = nextPacket(socket, "damage");
    // Simula o tick do loop sem criar intervalos globais (gameStarter).
    const result = PlayerAttackSystem.tryAttack(f.player, f.monster, f.world);
    assert.equal(result.ok, true);
    await damaged;
    await settle();
    assert.equal(packets(messages, "damage").length, 1);
  } finally { await f.close(); }
});

test("WebSocket: monstro atacando player notifica dano uma única vez", async () => {
  const f = await fixture();
  try {
    const { socket, messages } = await f.open();
    f.monster.attack = 9;
    const damaged = nextPacket(socket, "damage", (p) => p.targetId === f.player.id);
    const dealt = CombatSystem.attack(f.monster, f.player, f.world);
    const packet = await damaged;
    await settle();
    assert.equal(packet.damage, dealt);
    assert.equal(packets(messages, "damage").length, 1);
    assert.equal(packets(messages, "playerStats").length >= 1, true);
  } finally { await f.close(); }
});
