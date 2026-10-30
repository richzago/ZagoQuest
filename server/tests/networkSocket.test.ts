/**
 * Integração real com ws + servidor HTTP de teste em porta aleatória.
 * Não usa PostgreSQL, Unity nem porta fixa; sockets são fechados após cada caso.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket, type WebSocketServer as WsNodeServer } from "ws";
import { WebSocketServer as GameWebSocketServer } from "../src/network/websocket/wsServer";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { MAX_PACKET_BYTES } from "../src/network/validation/messageValidation";
import { MAX_MESSAGES_PER_SECOND } from "../src/network/validation/messageGuards";

interface Fixture {
  url: string;
  player: Player;
  connect(): Promise<WebSocket>;
  close(): Promise<void>;
}

async function createFixture(): Promise<Fixture> {
  const httpServer: Server = createServer();
  const world = new World();
  world.generateMap(10, 10);
  const player = new Player("network-player", "NetworkTester", 2, 2);
  world.addPlayer(player);

  const gameServer = new GameWebSocketServer(httpServer, world);
  const openClients: WebSocket[] = [];

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  return {
    url: `ws://127.0.0.1:${port}`,
    player,
    async connect() {
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      openClients.push(client);
      await once(client, "open");
      return client;
    },
    async close() {
      for (const ws of openClients) {
        if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
      }

      // O teste pode acessar o transporte internamente só para cleanup.
      const socketServer = (gameServer as unknown as { wss: WsNodeServer }).wss;
      await new Promise<void>((resolve) => socketServer.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

function nextPacket(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout aguardando pacote ${type}`));
    }, 3000);
    const onMessage = (data: WebSocket.RawData) => {
      const packet = JSON.parse(data.toString()) as Record<string, unknown>;
      if (packet.type !== type) return;
      cleanup();
      resolve(packet);
    };
    const onClose = () => {
      cleanup();
      reject(new Error(`Socket fechado antes do pacote ${type}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      ws.off("message", onMessage);
      ws.off("close", onClose);
    };
    ws.on("message", onMessage);
    ws.on("close", onClose);
  });
}

test("WebSocket real aceita passo válido e rejeita teleporte sem modificar jogador", async () => {
  const fixture = await createFixture();
  try {
    const ws = await fixture.connect();
    const position = nextPacket(ws, "position");
    ws.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    const moved = await position;
    assert.equal(moved.x, 3);
    assert.equal(moved.y, 2);
    assert.deepEqual(fixture.player.position, { x: 3, y: 2 });

    const rejected = nextPacket(ws, "position");
    ws.send(JSON.stringify({ type: "move", x: 9, y: 9 }));
    const current = await rejected;
    assert.deepEqual([current.x, current.y], [3, 2]);
    assert.deepEqual(fixture.player.position, { x: 3, y: 2 });
  } finally {
    await fixture.close();
  }
});

test("WebSocket real devolve networkError para pacote inválido sem executá-lo", async () => {
  const fixture = await createFixture();
  try {
    const ws = await fixture.connect();
    const response = nextPacket(ws, "networkError");
    ws.send(JSON.stringify({ type: "constructor" }));
    const packet = await response;
    assert.equal(packet.type, "networkError");
    assert.deepEqual(fixture.player.position, { x: 2, y: 2 });
    assert.equal(ws.readyState, WebSocket.OPEN); // Uma falha não desconecta.
  } finally {
    await fixture.close();
  }
});

test("segundo socket não pode controlar o mesmo personagem sem autenticação", async () => {
  const fixture = await createFixture();
  try {
    const first = await fixture.connect();
    const second = new WebSocket(fixture.url);
    const closed = once(second, "close");
    await once(second, "open");
    const [code] = await closed;
    assert.equal(code, 1008);
    assert.equal(first.readyState, WebSocket.OPEN);
  } finally {
    await fixture.close();
  }
});

test("pacote binário recebe fechamento WebSocket 1003", async () => {
  const fixture = await createFixture();
  try {
    const ws = await fixture.connect();
    const closed = once(ws, "close");
    ws.send(Buffer.from('{"type":"moveDir","dir":"east"}'), { binary: true });
    const [code] = await closed;
    assert.equal(code, 1003);
    assert.deepEqual(fixture.player.position, { x: 2, y: 2 });
  } finally {
    await fixture.close();
  }
});

test("frame maior que limite é bloqueado pelo transporte antes do handler", async () => {
  const fixture = await createFixture();
  try {
    const ws = await fixture.connect();
    const closed = once(ws, "close");
    ws.send(JSON.stringify({ type: "chat", message: "a".repeat(MAX_PACKET_BYTES) }));
    const [code] = await closed;
    assert.equal(code, 1009);
    assert.deepEqual(fixture.player.position, { x: 2, y: 2 });
  } finally {
    await fixture.close();
  }
});

test("mais de 30 comandos por segundo fecha o socket com código 1008", async () => {
  const fixture = await createFixture();
  try {
    const ws = await fixture.connect();
    const closed = once(ws, "close");
    for (let i = 0; i <= MAX_MESSAGES_PER_SECOND; i++) {
      ws.send(JSON.stringify({ type: "moveDir", dir: "east" }));
    }
    const [code] = await closed;
    assert.equal(code, 1008);
  } finally {
    await fixture.close();
  }
});
