/**
 * Integration: real Node HTTP + ws. Verifies that explicit WebSocketServer
 * shutdown releases sockets, drains handlers, and removes combat listeners.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { WebSocketServer as GameWs } from "../src/network/websocket/wsServer";
import { OrderedMessageQueue } from "../src/network/validation/messageGuards";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import type { CombatDamageEventData } from "../src/shared/interfaces/eventData.interface";
import { closeHttp, listenHttp } from "../src/game/core/httpLifecycle";

async function fixture() {
  const server: Server = createServer();
  const world = new World();
  world.generateMap(10, 10);
  const player = new Player("shutdown-player", "ShutdownPlayer", 2, 2);
  world.addPlayer(player);
  const game = new GameWs(server, world);
  await listenHttp(server, 0);

  const connect = async () => {
    const port = (server.address() as AddressInfo).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(socket, "open");
    return socket;
  };
  return { server, world, player, game, connect };
}

test("close do WebSocket rejeita novas mensagens e desconecta cliente real", async () => {
  const f = await fixture();
  const socket = await f.connect();
  try {
    const closed = once(socket, "close");
    await f.game.close();
    await closed;
    assert.equal(socket.readyState, WebSocket.CLOSED);
    assert.equal(f.game.getBroadcastService().getClients().size, 0);
    assert.equal(GameWs.getInstance(), undefined);
    // HTTP is a separate resource: WS close must NOT implicitly close REST.
    assert.equal(f.server.listening, true);
  } finally {
    if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    await f.game.close();
    await closeHttp(f.server);
  }
});

test("WebSocket close é idempotente mesmo com servidor HTTP não iniciado", async () => {
  const server = createServer();
  const world = new World();
  world.generateMap(5, 5);
  const game = new GameWs(server, world);
  try {
    const a = game.close();
    const b = game.close();
    assert.equal(a, b);
    await a;
    assert.equal(GameWs.getInstance(), undefined);
  } finally {
    await game.close();
    await closeHttp(server);
  }
});

test("WebSocket aguarda fila de handlers em andamento antes de fechar", async () => {
  const f = await fixture();
  const socket = await f.connect();
  const queues = (f.game as unknown as {
    messageQueues: Map<WebSocket, OrderedMessageQueue>;
  }).messageQueues;
  const queue = [...queues.values()][0];
  assert.ok(queue, "fila da conexão não foi registrada");

  let release!: () => void;
  let workCompleted = false;
  try {
    assert.equal(queue.enqueue(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      workCompleted = true;
    }), true);
    for (let i = 0; i < 8; i++) await Promise.resolve();

    const closing = f.game.close();
    let closed = false;
    void closing.then(() => { closed = true; });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(closed, false);
    assert.equal(workCompleted, false);

    release();
    await closing;
    assert.equal(workCompleted, true);
  } finally {
    if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    await f.game.close();
    await closeHttp(f.server);
  }
});

test("listener de dano do CombatEventBridge não sobrevive ao WebSocketServer", async () => {
  const f = await fixture();
  let broadcasts = 0;
  f.game.broadcastDamage = () => { broadcasts++; };
  try {
    const payload: CombatDamageEventData = {
      world: f.world, attackerId: "monster", attackerName: "Monster",
      targetId: f.player.id, targetName: f.player.name,
      targetMaxHp: 100, targetHpAfter: 99, damage: 1,
    };
    EventSystem.getInstance().emit(GameEvent.COMBAT_DAMAGE, payload);
    assert.equal(broadcasts, 1);
    await f.game.close();
    EventSystem.getInstance().emit(GameEvent.COMBAT_DAMAGE, payload);
    assert.equal(broadcasts, 1); // Bridge disposed.
  } finally {
    await f.game.close();
    await closeHttp(f.server);
  }
});


test("disconnected socket handler is drained before final shutdown", async () => {
  const f = await fixture();
  const socket = await f.connect();
  const queues = (f.game as unknown as {
    messageQueues: Map<WebSocket, OrderedMessageQueue>;
  }).messageQueues;
  const queue = [...queues.values()][0];
  assert.ok(queue);

  let release: (() => void) | undefined;
  let completed = false;
  try {
    queue.enqueue(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      completed = true;
    });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.ok(release, "in-flight handler did not start");

    // The client's "close" event does not guarantee the server has received
    // its own "close" event (notably on Windows). Observe both endpoints.
    const serverWss = (f.game as unknown as {
      wss: { clients: Set<WebSocket> };
    }).wss;
    const serverSocket = [...serverWss.clients][0];
    assert.ok(serverSocket, "server-side socket was not registered");

    const clientDisconnected = once(socket, "close");
    const serverDisconnected = once(serverSocket, "close");
    socket.close();
    await Promise.all([clientDisconnected, serverDisconnected]);

    assert.equal(f.game.getBroadcastService().getClients().size, 0);
    assert.equal(queues.get(serverSocket), queue, "pending queue should remain tracked");

    let shutdownCompleted = false;
    const shutdown = f.game.close().then(() => { shutdownCompleted = true; });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(shutdownCompleted, false);
    assert.equal(completed, false);

    release!();
    await shutdown;
    assert.equal(completed, true);
    assert.equal(queues.size, 0);
  } finally {
    release?.();
    if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    await f.game.close();
    await closeHttp(f.server);
  }
});
