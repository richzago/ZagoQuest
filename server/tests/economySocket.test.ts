/**
 * Integração econômica através de pacotes WebSocket REAIS.
 *
 * Os testes exercitam: JSON -> validação Zod -> fila ordenada ->
 * handlers -> sessões de NPC -> BankingSystem / ShopSystem.
 *
 * Tudo roda com servidor HTTP em porta aleatória, sem PostgreSQL e sem Unity.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket, type WebSocketServer as WsNodeServer } from "ws";
import { WebSocketServer as GameWebSocketServer } from "../src/network/websocket/wsServer";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { World } from "../src/game/world/World";

const potion = "consumable/health_potion";

interface Fixture {
  player: Player;
  world: World;
  banker: Npc;
  merchant: Npc;
  connect(): Promise<WebSocket>;
  close(): Promise<void>;
}

async function fixture(): Promise<Fixture> {
  const server: Server = createServer();
  const world = new World();
  world.generateMap(20, 20);
  const player = new Player("test-player", "SocketEconomy", 2, 2);
  player.gold = 100;
  world.addPlayer(player);

  const banker = new Npc("bank-1", "Banco", 3, 2, "Bem-vindo", "banker");
  const merchant = new Npc("shop-1", "Loja", 2, 3, "Olá", "merchant");
  merchant.shopItems = [
    { itemId: potion, buyPrice: 10, sellPrice: 5, stock: 10 },
  ];
  world.addNpc(banker);
  world.addNpc(merchant);

  const gameServer = new GameWebSocketServer(server, world);
  const clients: WebSocket[] = [];
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    player, world, banker, merchant,
    async connect() {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      clients.push(ws);
      await once(ws, "open");
      return ws;
    },
    async close() {
      clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
      });
      const internal = (gameServer as unknown as { wss: WsNodeServer }).wss;
      await new Promise<void>((resolve) => internal.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Escuta antes de enviar, pois os handlers podem responder muito rápido. */
function nextPacket(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout esperando ${type}`));
    }, 3000);
    const onMessage = (data: WebSocket.RawData) => {
      const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
      if (parsed.type !== type) return;
      cleanup();
      resolve(parsed);
    };
    const onClose = () => {
      cleanup();
      reject(new Error(`Socket fechado aguardando ${type}`));
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

async function send(ws: WebSocket, message: object, responseType: string) {
  const response = nextPacket(ws, responseType);
  ws.send(JSON.stringify(message));
  return response;
}

test("WebSocket: depósito sem openBank é rejeitado mesmo com pacote válido", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    const response = await send(ws, { type: "deposit", amount: 20 }, "bankResult");
    assert.equal(response.success, false);
    assert.equal(f.player.gold, 100);
    assert.equal(f.player.bankGold, 0);
  } finally {
    await f.close();
  }
});

test("WebSocket: openBank autoriza depósito e saque sem npcId no pacote", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    const opened = await send(ws, {
      type: "openBank", npcId: f.banker.id,
    }, "bankWindow");
    assert.equal(opened.npcId, f.banker.id);

    const deposited = await send(ws, { type: "deposit", amount: 30 }, "bankResult");
    assert.equal(deposited.success, true);
    assert.equal(deposited.gold, 70);
    assert.equal(deposited.bankGold, 30);

    const withdrawn = await send(ws, { type: "withdraw", amount: 10 }, "bankResult");
    assert.equal(withdrawn.success, true);
    assert.equal(f.player.gold, 80);
    assert.equal(f.player.bankGold, 20);
  } finally {
    await f.close();
  }
});

test("WebSocket: abrir loja é necessário antes de comprar do NPC", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    const command = {
      type: "buyItem", npcId: f.merchant.id, itemId: potion, amount: 2,
    };
    const denied = await send(ws, command, "buyResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.gold, 100);

    const shop = await send(ws, {
      type: "openShop", npcId: f.merchant.id,
    }, "shopWindow");
    assert.equal(shop.npcId, f.merchant.id);
    assert.equal((shop.items as unknown[]).length, 1);

    const bought = await send(ws, command, "buyResult");
    assert.equal(bought.success, true);
    assert.equal(f.player.gold, 80);
    assert.equal(f.player.inventory.get(potion), 2);
    assert.equal(f.merchant.shopItems![0].stock, 8);
  } finally {
    await f.close();
  }
});

test("WebSocket: NPC distante rejeita abertura de banco e loja", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    f.banker.position = { x: 15, y: 15 };
    f.merchant.position = { x: 15, y: 16 };

    const bankError = await send(ws, {
      type: "openBank", npcId: f.banker.id,
    }, "bankError");
    assert.equal(bankError.type, "bankError");
    const shopError = await send(ws, {
      type: "openShop", npcId: f.merchant.id,
    }, "shopError");
    assert.equal(shopError.type, "shopError");

    const denied = await send(ws, { type: "deposit", amount: 5 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.gold, 100);
  } finally {
    await f.close();
  }
});

test("WebSocket: mover para longe encerra banco mesmo mantendo janela no cliente", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    f.banker.position = { x: 0, y: 2 }; // Alcance 2 antes do passo.
    await send(ws, { type: "openBank", npcId: f.banker.id }, "bankWindow");
    const moved = await send(ws, { type: "moveDir", dir: "east" }, "position");
    assert.deepEqual([moved.x, moved.y], [3, 2]);

    // Mesmo que o cliente guarde a janela anterior, não tem autorização.
    const denied = await send(ws, { type: "deposit", amount: 10 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.gold, 100);
  } finally {
    await f.close();
  }
});

test("WebSocket: após reconectar, não reutiliza autorização anterior", async () => {
  const f = await fixture();
  try {
    const first = await f.connect();
    await send(first, { type: "openBank", npcId: f.banker.id }, "bankWindow");
    const closed = once(first, "close");
    first.close();
    await closed;

    const second = await f.connect();
    const denied = await send(second, { type: "withdraw", amount: 1 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.bankGold, 0);
  } finally {
    await f.close();
  }
});

test("WebSocket: closeBank fecha a sessão e impede depósito sem reabrir", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    await send(ws, { type: "openBank", npcId: f.banker.id }, "bankWindow");

    // close não responde; a fila ordenada garante que será processado antes
    // do próximo pacote de depósito.
    ws.send(JSON.stringify({ type: "closeBank", npcId: f.banker.id }));
    const denied = await send(ws, { type: "deposit", amount: 10 }, "bankResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.gold, 100);
    assert.equal(f.player.bankGold, 0);

    await send(ws, { type: "openBank", npcId: f.banker.id }, "bankWindow");
    const accepted = await send(ws, { type: "deposit", amount: 10 }, "bankResult");
    assert.equal(accepted.success, true);
    assert.equal(f.player.bankGold, 10);
  } finally {
    await f.close();
  }
});

test("WebSocket: closeShop impede compra, mas closeBank antigo não cancela loja", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    await send(ws, { type: "openShop", npcId: f.merchant.id }, "shopWindow");

    // Um close de outro serviço nunca pode apagar a sessão atual.
    ws.send(JSON.stringify({ type: "closeBank", npcId: f.banker.id }));
    const accepted = await send(ws, {
      type: "buyItem", npcId: f.merchant.id, itemId: potion, amount: 1,
    }, "buyResult");
    assert.equal(accepted.success, true);
    assert.equal(f.player.gold, 90);

    ws.send(JSON.stringify({ type: "closeShop", npcId: f.merchant.id }));
    const denied = await send(ws, {
      type: "buyItem", npcId: f.merchant.id, itemId: potion, amount: 1,
    }, "buyResult");
    assert.equal(denied.success, false);
    assert.equal(f.player.gold, 90);
    assert.equal(f.merchant.shopItems![0].stock, 9);
  } finally {
    await f.close();
  }
});

test("WebSocket: depositar e sacar emite bankResult e gold com saldos atualizados", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    f.player.bankGold = 30;

    const opened = await send(ws, { type: "openBank", npcId: f.banker.id }, "bankWindow");
    assert.deepEqual([opened.gold, opened.bankGold], [100, 30]);

    // Instala as duas esperas ANTES de mandar o pacote para não perder respostas.
    const depositResult = nextPacket(ws, "bankResult");
    const depositGold = nextPacket(ws, "gold");
    ws.send(JSON.stringify({ type: "deposit", amount: 25 }));
    const [resultD, balanceD] = await Promise.all([depositResult, depositGold]);
    assert.equal(resultD.success, true);
    assert.deepEqual([resultD.gold, resultD.bankGold, balanceD.gold], [75, 55, 75]);

    const withdrawResult = nextPacket(ws, "bankResult");
    const withdrawGold = nextPacket(ws, "gold");
    ws.send(JSON.stringify({ type: "withdraw", amount: 15 }));
    const [resultW, balanceW] = await Promise.all([withdrawResult, withdrawGold]);
    assert.equal(resultW.success, true);
    assert.deepEqual([resultW.gold, resultW.bankGold, balanceW.gold], [90, 40, 90]);
    assert.equal(f.player.gold + f.player.bankGold, 130);
  } finally {
    await f.close();
  }
});

test("WebSocket: saques sem saldo, depósitos excessivos e quantia zero preservam saldos", async () => {
  const f = await fixture();
  try {
    const ws = await f.connect();
    await send(ws, { type: "openBank", npcId: f.banker.id }, "bankWindow");
    const tooMuch = await send(ws, { type: "deposit", amount: 101 }, "bankResult");
    const noBankGold = await send(ws, { type: "withdraw", amount: 1 }, "bankResult");
    assert.equal(tooMuch.success, false);
    assert.equal(noBankGold.success, false);
    assert.deepEqual([f.player.gold, f.player.bankGold], [100, 0]);

    // Mesmo um cliente adulterado não deve poder depositar zero.
    const invalid = await send(ws, { type: "deposit", amount: 0 }, "networkError");
    assert.equal(invalid.type, "networkError");
    assert.deepEqual([f.player.gold, f.player.bankGold], [100, 0]);
  } finally {
    await f.close();
  }
});
