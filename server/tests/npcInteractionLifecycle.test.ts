/**
 * Regressões de conversa/painel: banco, loja e chat compartilham o mesmo
 * bloqueio da IA. Os testes de rede usam WebSocket real e o parser oficial.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { NpcAI } from "../src/game/ai/npcAI";
import { NpcInteractionSystem } from "../src/game/systems/npcInteractionSystem";
import { WebSocketServer as GameWebSocketServer } from "../src/network/websocket/wsServer";
import { ChatSystem } from "../src/game/chat/chatSystem";
import { processChatCommand } from "../src/game/chat/chatCommands";

function createWorld() {
  const world = new World();
  world.generateMap(12, 12);
  const player = new Player("interactor", "Interactor", 4, 4);
  const banker = new Npc("bank-1", "Banker", 5, 4, "Hello", "banker");
  const merchant = new Npc("shop-1", "Merchant", 4, 5, "Hi", "merchant");
  banker.ai = new NpcAI(5, 4, 2, 1);
  merchant.ai = new NpcAI(4, 5, 2, 1);
  merchant.shopItems = [
    { itemId: "consumable/health_potion", buyPrice: 10, sellPrice: 5, stock: 10 },
  ];
  world.addPlayer(player);
  world.addNpc(banker);
  world.addNpc(merchant);
  return { world, player, banker, merchant };
}

test("abrir o banco por clique pausa NPC, fechar volta a permitir IA", (t) => {
  const { world, player, banker } = createWorld();
  t.mock.method(Math, "random", () => 0); // primeiro movimento válido: leste
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(banker.isTalking, true);
  assert.equal(banker.talkingToPlayerId, player.id);
  banker.ai!.update(banker, world);
  assert.deepEqual(banker.position, { x: 5, y: 4 });
  assert.equal(NpcInteractionSystem.closeIfActive(player, "banker", banker.id), true);
  assert.equal(banker.isTalking, false);
  assert.equal(banker.talkingToPlayerId, undefined);
  banker.ai!.update(banker, world);
  assert.deepEqual(banker.position, { x: 6, y: 4 });
});

test("close de outro NPC não libera conversa; troca para loja libera banco", () => {
  const { world, player, banker, merchant } = createWorld();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(NpcInteractionSystem.closeIfActive(player, "merchant", merchant.id), false);
  assert.equal(banker.isTalking, true);
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  assert.equal(banker.isTalking, false);
  assert.equal(merchant.isTalking, true);
  assert.equal(merchant.talkingToPlayerId, player.id);
  NpcInteractionSystem.close(player);
  assert.equal(merchant.isTalking, false);
});

test("distância revoga autorização e libera o NPC para andar", () => {
  const { world, player, banker } = createWorld();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  player.position = { x: 9, y: 9 };
  NpcInteractionSystem.invalidateIfOutOfRange(player, world);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
  assert.equal(banker.isTalking, false);
});

test("outro jogador não rouba NPC ocupado; sessão original permanece", () => {
  const { world, player, banker } = createWorld();
  const rival = new Player("rival", "Rival", 4, 4);
  world.addPlayer(rival);
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(NpcInteractionSystem.open(rival, world, banker, "banker"), false);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), banker);
  assert.equal(banker.talkingToPlayerId, player.id);
});

test("bye encerra janela econômica e diálogo, mantendo saudação para o chat", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  const { world, player, banker } = createWorld();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  await processChatCommand("/bye", player, world);
  assert.equal(banker.isTalking, false);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

async function withSocket(
  operation: (state: ReturnType<typeof createWorld>, ws: WebSocket) => Promise<void>,
): Promise<void> {
  const state = createWorld();
  const server: Server = createServer();
  const sockets: WebSocket[] = [];
  const transport = new GameWebSocketServer(server, state.world, { authRequired: false });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(ws);
    await once(ws, "open");
    await operation(state, ws);
  } finally {
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
    }
    await transport.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function nextMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { done(); reject(new Error(`Timeout ${type}`)); }, 3000);
    const onMessage = (raw: WebSocket.RawData) => {
      const data = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (data.type !== type) return;
      done();
      resolve(data);
    };
    const onClose = () => { done(); reject(new Error(`Fechado antes de ${type}`)); };
    const done = () => {
      clearTimeout(timeout);
      ws.off("message", onMessage);
      ws.off("close", onClose);
    };
    ws.on("message", onMessage);
    ws.on("close", onClose);
  });
}
async function send(ws: WebSocket, packet: object, responseType: string) {
  const result = nextMessage(ws, responseType);
  ws.send(JSON.stringify(packet));
  return result;
}

test("WS: clique openBank congela NPC; closeBank solta e nega depósito", async () => {
  await withSocket(async ({ banker, player }, ws) => {
    const opened = await send(ws, { type: "openBank", npcId: banker.id }, "bankWindow");
    assert.equal(opened.npcId, banker.id);
    assert.equal(banker.isTalking, true);
    assert.equal(banker.talkingToPlayerId, player.id);
    ws.send(JSON.stringify({ type: "closeBank", npcId: banker.id }));
    const denied = await send(ws, { type: "deposit", amount: 1 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(banker.isTalking, false);
  });
});

test("WS: hi abre o painel do Banker e bye permite que o NPC ande", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  await withSocket(async ({ banker }, ws) => {
    const opened = await send(ws, { type: "chat", message: "hi" }, "bankWindow");
    assert.equal(opened.npcId, banker.id);
    assert.equal(banker.isTalking, true);
    // "bye" não exige mensagem de resposta; a fila do socket é ordenada.
    ws.send(JSON.stringify({ type: "chat", message: "bye" }));
    const denied = await send(ws, { type: "deposit", amount: 1 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(banker.isTalking, false);
  });
});

test("WS: /hi abre loja do NPC mais próximo quando banqueiro está longe", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  await withSocket(async ({ banker, merchant }, ws) => {
    banker.position = { x: 10, y: 10 };
    const opened = await send(ws, { type: "chat", message: "/hi" }, "shopWindow");
    assert.equal(opened.npcId, merchant.id);
    assert.equal(merchant.isTalking, true);
  });
});

test("WS: desconectar libera NPC após o servidor processar o fechamento", async () => {
  await withSocket(async ({ banker }, ws) => {
    await send(ws, { type: "openBank", npcId: banker.id }, "bankWindow");
    assert.equal(banker.isTalking, true);
    const clientClosed = once(ws, "close");
    ws.close();
    await clientClosed;

    // O close do CLIENTE pode chegar antes do close do servidor (Windows).
    // Aguarda o evento autoritativo, com limite, sem afetar o game loop.
    const deadline = Date.now() + 1000;
    while (banker.isTalking && Date.now() < deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
    assert.equal(banker.isTalking, false);
  });
});
