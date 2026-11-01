/**
 * Regressões de autorização econômica (NPC ↔ jogador ↔ mundo).
 * Testes independentes de PostgreSQL e de Unity, cobrindo também handlers.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebSocket } from "ws";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { Player } from "../src/game/entities/player";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { join } from "node:path";
import { Npc } from "../src/game/entities/npc";
import { World } from "../src/game/world/World";
import { NpcInteractionSystem, NPC_INTERACTION_RANGE } from "../src/game/systems/npcInteractionSystem";
import { BankingSystem } from "../src/game/systems/bankingSystem";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { MAX_GOLD } from "../src/game/systems/economyRules";
import { handleOpenBank, handleDeposit, handleWithdraw } from "../src/network/handlers/bank.handler";
import { handleOpenShop, handleBuyItem, handleSellItem } from "../src/network/handlers/shop.handler";
import { parseClientMessage } from "../src/network/validation/messageValidation";
import { handleMoveDir } from "../src/network/handlers/move.handler";
import { processChatCommand } from "../src/game/chat/chatCommands";
import { ChatSystem } from "../src/game/chat/chatSystem";

const potion = "consumable/health_potion";
const ws = {} as WebSocket;

function setup() {
  const world = new World();
  world.generateMap(20, 20);
  const player = new Player("test-player", "Testador", 2, 2);
  // Testes de autorização econômica pressupõem Bag válida; sem ela,
  // o bloqueio de poções fica coberto em suíte C10 específica.
  ItemRegistry.loadAll(join(process.cwd(),"src","data","items"));
  player.equipment.set(EquipmentSlot.BACKPACK,"equipment/backpack/basic_backpack");
  player.restoreBagState(undefined);
  const banker = new Npc("bank-1", "Banco", 3, 2, "Olá", "banker");
  const merchant = new Npc("shop-1", "Loja", 2, 3, "Bem-vindo", "merchant");
  merchant.shopItems = [{ itemId: potion, buyPrice: 10, sellPrice: 5, stock: 5 }];
  world.addNpc(banker);
  world.addNpc(merchant);
  player.gold = 100;
  world.addPlayer(player);
  return { world, player, banker, merchant };
}

function createContext(world: World) {
  const events = {
    bankWindow: [] as unknown[][],
    bankResult: [] as unknown[][],
    bankError: [] as string[],
    shopWindow: [] as unknown[][],
    buyResult: [] as [boolean, string][],
    sellResult: [] as [boolean, string][],
    shopError: [] as string[],
    position: [] as [number, number][],
    broadcast: [] as unknown[][],
    inventory: 0,
    gold: 0,
  };
  const ctx = {
    world,
    packetSender: {
      bank: {
        sendBankWindow: (...args: unknown[]) => { events.bankWindow.push(args); },
        sendBankResult: (...args: unknown[]) => { events.bankResult.push(args); },
        sendBankError: (msg: string) => { events.bankError.push(msg); },
      },
      shop: {
        sendShopWindow: (...args: unknown[]) => { events.shopWindow.push(args); },
        sendBuyResult: (success: boolean, message: string) => {
          events.buyResult.push([success, message]);
        },
        sendShopError: (msg: string) => { events.shopError.push(msg); },
        sendSellResult: (success: boolean, message: string) => {
          events.sellResult.push([success, message]);
        },
      },
      inventory: {
        sendGold: () => { events.gold++; },
        sendInventory: () => { events.inventory++; },
        sendPlayerStats: () => {},
      },
      combat: {
        sendPosition: (x: number, y: number) => { events.position.push([x, y]); },
      },
    },
    broadcast: {
      broadcastMove: (...args: unknown[]) => { events.broadcast.push(args); },
    },
  } as unknown as HandlerContext;
  return { ctx, events };
}

test("regra de alcance utiliza distância Manhattan de no máximo dois tiles", () => {
  const { world, player, banker } = setup();
  assert.equal(NPC_INTERACTION_RANGE, 2);
  assert.equal(NpcInteractionSystem.canInteract(player, world, banker, "banker"), true);
  banker.position = { x: 4, y: 2 };
  assert.equal(NpcInteractionSystem.canInteract(player, world, banker, "banker"), true);
  banker.position = { x: 4, y: 3 };
  assert.equal(NpcInteractionSystem.canInteract(player, world, banker, "banker"), false);
});

test("autorização rejeita NPC de outro tipo, inexistente ou com coordenadas inválidas", () => {
  const { world, player, banker, merchant } = setup();
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "banker"), false);
  assert.equal(NpcInteractionSystem.open(player, world,
    new Npc("fake", "Falso", 2, 2, "", "banker"), "banker"), false);
  banker.position.x = NaN;
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), false);
});

test("abrir loja cria autorização exclusiva para esse jogador e esse NPC", () => {
  const { world, player, merchant } = setup();
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant", merchant.id), merchant);
  const other = new Player("other", "Outro", 2, 2);
  assert.equal(NpcInteractionSystem.getActive(other, world, "merchant"), undefined);
});

test("a sessão econômica de um mundo não autoriza operações em outro mundo", () => {
  const { world, player, banker } = setup();
  NpcInteractionSystem.open(player, world, banker, "banker");
  const differentWorld = new World();
  assert.equal(NpcInteractionSystem.getActive(player, differentWorld, "banker"), undefined);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

test("trocar banco por loja revoga sessão bancária", () => {
  const { world, player, banker, merchant } = setup();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant"), undefined);
});

test("ID de loja diferente não permite aproveitar uma janela antiga", () => {
  const { world, player, merchant } = setup();
  NpcInteractionSystem.open(player, world, merchant, "merchant");
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant", "other-shop"), undefined);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant", merchant.id), undefined);
});

test("voltar para perto depois de sair não reabre autorização automaticamente", () => {
  const { world, player, banker } = setup();
  NpcInteractionSystem.open(player, world, banker, "banker");
  player.position.x = 10;
  NpcInteractionSystem.invalidateIfOutOfRange(player, world);
  player.position.x = 2;
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

test("mudança de posição do próprio NPC invalida a interação", () => {
  const { world, player, merchant } = setup();
  NpcInteractionSystem.open(player, world, merchant, "merchant");
  merchant.position.x = 18;
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant"), undefined);
});

test("remoção de NPC do mundo ou mudança de tipo revogam autorização", () => {
  const { world, player, banker } = setup();
  NpcInteractionSystem.open(player, world, banker, "banker");
  world.npcs.splice(world.npcs.indexOf(banker), 1);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);

  world.npcs.push(banker);
  NpcInteractionSystem.open(player, world, banker, "banker");
  banker.npcType = "merchant";
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

test("jogador ou NPC morto perde permissão de interagir", () => {
  const a = setup();
  NpcInteractionSystem.open(a.player, a.world, a.banker, "banker");
  a.player.hp = 0;
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), undefined);
  a.player.hp = a.player.maxHp;
  NpcInteractionSystem.open(a.player, a.world, a.banker, "banker");
  a.banker.hp = 0;
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), undefined);
});

test("close é idempotente e revoga uma autorização existente", () => {
  const { world, player, banker } = setup();
  NpcInteractionSystem.open(player, world, banker, "banker");
  NpcInteractionSystem.close(player);
  NpcInteractionSystem.close(player);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

test("abrir banco perto é permitido; abrir longe devolve erro", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  assert.equal(events.bankWindow.length, 1);
  a.player.position = { x: 15, y: 15 };
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  assert.equal(events.bankWindow.length, 1);
  assert.equal(events.bankError.length, 1);
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), undefined);
});

test("abrir banco com NPC comerciante ou ID inexistente não concede sessão", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  for (const npcId of [a.merchant.id, "bank-fake"]) {
    await handleOpenBank(ws, a.player, { type: "openBank", npcId }, ctx);
  }
  assert.equal(events.bankWindow.length, 0);
  assert.equal(events.bankError.length, 2);
});

test("deposit e withdraw sem abrir banco não alteram saldos", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  a.player.bankGold = 80;
  await handleDeposit(ws, a.player, { type: "deposit", amount: 20 }, ctx);
  await handleWithdraw(ws, a.player, { type: "withdraw", amount: 20 }, ctx);
  assert.equal(a.player.gold, 100);
  assert.equal(a.player.bankGold, 80);
  assert.equal(events.bankResult.length, 2);
  assert.ok(events.bankResult.every((args) => args[0] === false));
  assert.equal(events.gold, 0);
});

test("depósito e saque autorizados preservam o total e atualizam o Unity", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  a.player.bankGold = 20;
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await handleDeposit(ws, a.player, { type: "deposit", amount: 30 }, ctx);
  await handleWithdraw(ws, a.player, { type: "withdraw", amount: 10 }, ctx);
  assert.deepEqual([a.player.gold, a.player.bankGold], [80, 40]);
  assert.equal(events.gold, 2);
  assert.deepEqual(events.bankResult.map((args) => args[0]), [true, true]);
});

test("depósito inválido ou saldo insuficiente não perdem dinheiro", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await handleDeposit(ws, a.player, { type: "deposit", amount: 101 }, ctx);
  await handleWithdraw(ws, a.player, { type: "withdraw", amount: 1 }, ctx);
  assert.deepEqual([a.player.gold, a.player.bankGold], [100, 0]);
  assert.ok(events.bankResult.every((args) => args[0] === false));
});

test("abrir loja longe ou abrir NPC sem catálogo não concede autorização", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  a.player.position = { x: 15, y: 15 };
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: a.merchant.id }, ctx);
  a.player.position = { x: 2, y: 2 };
  a.merchant.shopItems = [];
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: a.merchant.id }, ctx);
  assert.equal(events.shopWindow.length, 0);
  assert.equal(events.shopError.length, 2);
});

test("buyItem sem openShop não retira dinheiro nem cria itens", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleBuyItem(ws, a.player, {
    type: "buyItem", npcId: a.merchant.id, itemId: potion, amount: 2,
  }, ctx);
  assert.deepEqual(events.buyResult.map((entry) => entry[0]), [false]);
  assert.equal(a.player.gold, 100);
  assert.equal(a.player.inventory.size, 0);
  assert.equal(a.merchant.shopItems![0].stock, 5);
});

test("abrir loja por nome retorna o ID real e permite comprar somente nessa loja", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: "LOJA" }, ctx);
  assert.equal(events.shopWindow[0][0], a.merchant.id);
  assert.equal("stock" in (events.shopWindow[0][1] as object[])[0], false);
  await handleBuyItem(ws, a.player, {
    type: "buyItem", npcId: a.merchant.id, itemId: potion, amount: 2,
  }, ctx);
  assert.equal(events.buyResult[0][0], true);
  assert.equal(a.player.gold, 80);
  assert.equal(a.player.inventory.get(potion), 2);
  assert.equal(a.merchant.shopItems![0].stock, 5);
  assert.equal(events.inventory, 1);
  assert.equal(events.gold, 1);
});

test("compra por outro NPC não funciona mesmo após abrir loja legítima", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: a.merchant.id }, ctx);
  await handleBuyItem(ws, a.player, {
    type: "buyItem", npcId: "outra-loja", itemId: potion, amount: 1,
  }, ctx);
  assert.equal(events.buyResult[0][0], false);
  assert.equal(a.player.gold, 100);
  assert.equal(a.merchant.shopItems![0].stock, 5);
});

test("catálogo legado com ID não registrado abre sem lançar exceção", async () => {
  const a = setup();
  a.merchant.shopItems = [
    { itemId: "legacy/item-inexistente", buyPrice: 1, sellPrice: 0, stock: 1 },
  ];
  const { ctx, events } = createContext(a.world);
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: a.merchant.id }, ctx);
  const items = events.shopWindow[0][1] as { itemId: string; name: string }[];
  assert.equal(items[0].name, "legacy/item-inexistente");
});

test("abrir outro serviço invalida o banco, sem permitir saque indireto", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  a.player.bankGold = 50;
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: a.merchant.id }, ctx);
  await handleWithdraw(ws, a.player, { type: "withdraw", amount: 10 }, ctx);
  assert.equal(events.bankResult[0][0], false);
  assert.equal(a.player.bankGold, 50);
});

test("um passo WASD para longe revoga autorização antes da próxima operação", async () => {
  const a = setup();
  a.banker.position = { x: 0, y: 2 }; // Inicialmente a dois tiles.
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await handleMoveDir(ws, a.player, { type: "moveDir", dir: "east" }, ctx);
  assert.deepEqual(a.player.position, { x: 3, y: 2 });
  a.player.position = { x: 2, y: 2 }; // Voltar artificialmente não reabre janela.
  await handleDeposit(ws, a.player, { type: "deposit", amount: 10 }, ctx);
  assert.equal(events.bankResult[0][0], false);
  assert.equal(a.player.gold, 100);
});

test("tentativa de movimento inválido não cancela sessão de banco", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await handleMoveDir(ws, a.player, { type: "moveDir", dir: "__proto__" as never }, ctx);
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), a.banker);
  assert.equal(events.position.length, 1);
});

test("despedida /bye cancela acesso bancário mesmo sem diálogo aberto", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  await processChatCommand("/bye", a.player, a.world);
  await handleDeposit(ws, a.player, { type: "deposit", amount: 10 }, ctx);
  assert.equal(events.bankResult[0][0], false);
});

test("novo cumprimento /hi também revoga sessão econômica anterior", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  const a = setup();
  NpcInteractionSystem.open(a.player, a.world, a.banker, "banker");
  await processChatCommand("/hi", a.player, a.world);
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), undefined);
});

test("configuração de loja não pode gerar gold vendendo moedas abaixo do valor facial", () => {
  const a = setup();
  const coinShop = a.merchant;
  coinShop.shopItems = [
    { itemId: "currency/platinum_coin", buyPrice: 1, sellPrice: 0, stock: 5 },
  ];
  const before = a.player.gold;
  assert.equal(ShopSystem.buyItem(a.player, coinShop, "currency/platinum_coin", 1), false);
  assert.equal(a.player.gold, before);
  assert.equal(coinShop.shopItems[0].stock, 5);
});

test("restrição de overflow anterior continua vigente para lojas", () => {
  const a = setup();
  a.player.gold = MAX_GOLD;
  a.merchant.shopItems![0].buyPrice = Number.MAX_SAFE_INTEGER;
  assert.equal(ShopSystem.buyItem(a.player, a.merchant, potion, 2), false);
  assert.equal(a.player.gold, MAX_GOLD);
});

test("BankingSystem continua sendo independente de rede e autorização de NPC", () => {
  const a = setup();
  // Por design, a autorização é responsabilidade do handler, NÃO do domínio
  // para permitir operações internas controladas do servidor no futuro.
  assert.equal(BankingSystem.depositGold(a.player, 10), true);
  assert.deepEqual([a.player.gold, a.player.bankGold], [90, 10]);
});


test("tentativa de abrir um comerciante inválido revoga a sessão anterior do banco", async () => {
  const a = setup();
  const { ctx, events } = createContext(a.world);
  await handleOpenBank(ws, a.player, { type: "openBank", npcId: a.banker.id }, ctx);
  assert.equal(NpcInteractionSystem.getActive(a.player, a.world, "banker"), a.banker);

  // Não permitir que janelas antigas autorizem operações depois de trocar
  // para um serviço inexistente.
  await handleOpenShop(ws, a.player, { type: "openShop", npcId: "unknown-merchant" }, ctx);
  await handleDeposit(ws, a.player, { type: "deposit", amount: 10 }, ctx);
  assert.equal(events.shopError.length, 1);
  assert.equal(events.bankResult[0][0], false);
  assert.equal(a.player.gold, 100);
});


test("C6 venda: catálogo do merchant informa preço de compra e revenda sem estoque",async()=>{
 const a=setup(),{ctx,events}=createContext(a.world);
 await handleOpenShop(ws,a.player,{type:"openShop",npcId:a.merchant.id},ctx);
 const row=(events.shopWindow[0][1] as Array<Record<string,unknown>>)[0];
 assert.equal(row.itemId,potion);
 assert.equal(row.price,10);
 assert.equal(row.sellPrice,5);
 assert.equal("stock" in row,false);
});

test("C6 venda autorizada entrega gold em mãos e remove só a quantidade vendida",async()=>{
 const a=setup(),{ctx,events}=createContext(a.world);
 a.player.addItem(potion,3);
 await handleOpenShop(ws,a.player,{type:"openShop",npcId:a.merchant.id},ctx);
 await handleSellItem(ws,a.player,{type:"sellItem",npcId:a.merchant.id,itemId:potion,amount:2},ctx);
 assert.deepEqual(events.sellResult.map(x=>x[0]),[true]);
 assert.equal(a.player.gold,110);
 assert.equal(a.player.inventory.get(potion),1);
 assert.equal(events.inventory,1);
 assert.equal(events.gold,1);
});

test("C6 venda sem abrir loja ou usando NPC errado não altera inventário e saldo",async()=>{
 const a=setup(),{ctx,events}=createContext(a.world);
 a.player.addItem(potion,2);
 await handleSellItem(ws,a.player,{type:"sellItem",npcId:a.merchant.id,itemId:potion,amount:1},ctx);
 await handleOpenShop(ws,a.player,{type:"openShop",npcId:a.merchant.id},ctx);
 await handleSellItem(ws,a.player,{type:"sellItem",npcId:"npc-falso",itemId:potion,amount:1},ctx);
 assert.deepEqual(events.sellResult.map(x=>x[0]),[false,false]);
 assert.deepEqual([a.player.gold,a.player.inventory.get(potion)],[100,2]);
});

test("C6 venda fora do alcance ou após fechar sessão não funciona",async()=>{
 const a=setup(),{ctx,events}=createContext(a.world);
 a.player.addItem(potion,2);
 await handleOpenShop(ws,a.player,{type:"openShop",npcId:a.merchant.id},ctx);
 a.player.position={x:18,y:18};
 await handleSellItem(ws,a.player,{type:"sellItem",npcId:a.merchant.id,itemId:potion,amount:1},ctx);
 a.player.position={x:2,y:2};
 await handleOpenShop(ws,a.player,{type:"openShop",npcId:a.merchant.id},ctx);
 NpcInteractionSystem.close(a.player);
 await handleSellItem(ws,a.player,{type:"sellItem",npcId:a.merchant.id,itemId:potion,amount:1},ctx);
 assert.deepEqual(events.sellResult.map(x=>x[0]),[false,false]);
 assert.equal(a.player.gold,100);assert.equal(a.player.inventory.get(potion),2);
});

test("C6 venda inválida: quantidade zero, negativa, fração, ausente e overflow",()=>{
 const a=setup();a.player.addItem(potion,4);
 for(const qty of [0,-1,1.5,NaN,Infinity,5,Number.MAX_SAFE_INTEGER])
  assert.equal(ShopSystem.sellItem(a.player,a.merchant,potion,qty),false);
 assert.equal(a.player.inventory.get(potion),4);
 assert.equal(a.player.gold,100);
});

test("C6 venda não aceita arbitragem, preço maior ou igual à compra e moedas",()=>{
 const a=setup();a.player.addItem(potion,3);
 a.merchant.shopItems![0].sellPrice=10;
 assert.equal(ShopSystem.sellItem(a.player,a.merchant,potion,1),false);
 a.merchant.shopItems![0].sellPrice=11;
 assert.equal(ShopSystem.sellItem(a.player,a.merchant,potion,1),false);
 a.merchant.shopItems![0].sellPrice=-1;
 assert.equal(ShopSystem.sellItem(a.player,a.merchant,potion,1),false);
 a.merchant.shopItems![0].sellPrice=5;
 const coin="currency/gold_coin";
 a.merchant.shopItems!.push({itemId:coin,buyPrice:5,sellPrice:2});
 a.player.addItem(coin,1);
 assert.equal(ShopSystem.sellItem(a.player,a.merchant,coin,1),false);
 assert.equal(a.player.inventory.get(potion),3);
});

test("C6 protocolo de venda: schema bloqueia preço client-side e quantidade adulterada",()=>{
 const ok={type:"sellItem",npcId:"merchant",itemId:potion,amount:2};
 assert.equal(parseClientMessage(JSON.stringify(ok)).ok,true);
 for(const invalid of [
  {...ok,price:1000000}, {...ok,amount:-1},{...ok,amount:0},
  {...ok,amount:1.5},{...ok,npcId:""},{...ok,itemId:""},
  {...ok,amount:"2"},
 ])assert.equal(parseClientMessage(JSON.stringify(invalid)).ok,false,
  JSON.stringify(invalid));
});

test("C6 venda: crédito além do limite não retira item e não altera saldo",()=>{
 const a=setup();
 a.player.gold=MAX_GOLD;
 a.player.addItem(potion,1);
 assert.equal(ShopSystem.sellItem(a.player,a.merchant,potion,1),false);
 assert.equal(a.player.gold,MAX_GOLD);
 assert.equal(a.player.inventory.get(potion),1);
});
