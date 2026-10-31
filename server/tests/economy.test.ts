import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { World } from "../src/game/world/World";
import { ItemOnGround } from "../src/game/entities/itemOnGround";
import { Corpse } from "../src/game/entities/corpse";
import { BankingSystem } from "../src/game/systems/bankingSystem";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { MAX_GOLD } from "../src/game/systems/economyRules";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { handleDropItem, handlePickupItem } from "../src/network/handlers/inventory.handler";
import { handleTakeLoot } from "../src/network/handlers/loot.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import type { WebSocket } from "ws";

const potion = "consumable/health_potion";
const createPlayer = () => new Player("player-test", "Testador", 2, 2);
const createMerchant = () => {
  const npc = new Npc("merchant-1", "Mercador", 3, 2, "Olá", "merchant");
  npc.shopItems = [{ itemId: potion, buyPrice: 10, sellPrice: 4, stock: 5 }];
  return npc;
};
const invalid = [0, -1, -10, 0.5, NaN, Infinity, -Infinity, "3", null, undefined];

// O domínio sempre rejeita dados inválidos, mesmo que o handler falhe em validar.
test("addItem não recebe quantidades inválidas", () => {
  const player = createPlayer();
  for (const amount of invalid) {
    assert.equal(player.addItem(potion, amount as number), false);
    assert.equal(player.inventory.size, 0);
  }
});

test("removeItem não transforma negativos em itens", () => {
  const player = createPlayer();
  assert.equal(player.addItem(potion, 10), true);
  for (const amount of invalid) {
    assert.equal(player.removeItem(potion, amount as number), false);
    assert.equal(player.hasItem(potion, amount as number), false);
    assert.equal(player.inventory.get(potion), 10);
  }
  assert.equal(player.removeItem(potion, 4), true);
  assert.equal(player.inventory.get(potion), 6);
  assert.equal(player.removeItem(potion, 6), true);
  assert.equal(player.inventory.has(potion), false);
});

test("addGold e removeGold não permitem saldo negativo ou overflow", () => {
  const player = createPlayer();
  for (const amount of invalid) {
    assert.equal(player.addGold(amount as number), false);
    assert.equal(player.removeGold(amount as number), false);
  }
  assert.equal(player.addGold(MAX_GOLD), true);
  assert.equal(player.addGold(1), false);
  assert.equal(player.gold, MAX_GOLD);
  assert.equal(player.removeGold(MAX_GOLD), true);
  assert.equal(player.gold, 0);
  assert.equal(player.removeGold(1), false);
});

test("moedas são convertidas sem inserção no inventário", () => {
  const player = createPlayer();
  assert.equal(player.addItem("currency/gold_coin", 10), true);
  assert.equal(player.addItem("currency/platinum_coin", 2), true);
  assert.equal(player.addItem("currency/crystal_coin", 1), true);
  assert.equal(player.gold, 10210);
  assert.equal(player.inventory.size, 0);
});

test("moedas não aceitam overflow nem nomes herdados do protótipo", () => {
  const player = createPlayer();
  assert.equal(player.addItem("currency/crystal_coin", MAX_GOLD), false);
  assert.equal(player.gold, 0);
  assert.equal(player.addItem("toString", 1), true); // ID normal, não moeda!
  assert.equal(player.gold, 0);
  assert.equal(player.inventory.get("toString"), 1);
});

test("canAddItems detecta moedas e itens duplicados no mesmo loot", () => {
  const player = createPlayer();
  player.gold = MAX_GOLD - 4;
  assert.equal(player.canAddItems([
    { itemId: "currency/gold_coin", amount: 3 },
    { itemId: "currency/gold_coin", amount: 3 },
  ]), false);
  assert.equal(player.gold, MAX_GOLD - 4);
  assert.equal(player.canAddItems([
    { itemId: potion, amount: 2 },
    { itemId: potion, amount: 3 },
  ]), true);
});

test("unequip não apaga o item se o inventário está no limite", () => {
  const player = createPlayer();
  const item = "equipment/weapon/swords/boneSword";
  player.equipment.set(EquipmentSlot.WEAPON, item);
  player.inventory.set(item, Number.MAX_SAFE_INTEGER);
  assert.equal(player.unequipItem(EquipmentSlot.WEAPON), false);
  assert.equal(player.equipment.get(EquipmentSlot.WEAPON), item);
});

test("depositar e sacar conserva o total de gold", () => {
  const player = createPlayer();
  player.gold = 200;
  player.bankGold = 50;
  assert.equal(BankingSystem.depositGold(player, 75), true);
  assert.equal(BankingSystem.withdrawGold(player, 25), true);
  assert.equal(player.gold, 150);
  assert.equal(player.bankGold, 100);
  assert.equal(player.gold + player.bankGold, 250);
});

test("banco rejeita inválidos, saldo insuficiente e overflow sem mudar contas", () => {
  const player = createPlayer();
  player.gold = 50;
  player.bankGold = MAX_GOLD;
  for (const amount of invalid) {
    assert.equal(BankingSystem.depositGold(player, amount as number), false);
    assert.equal(BankingSystem.withdrawGold(player, amount as number), false);
  }
  assert.equal(BankingSystem.depositGold(player, 1), false);
  assert.equal(player.gold, 50);
  assert.equal(player.bankGold, MAX_GOLD);
  assert.equal(BankingSystem.withdrawGold(player, 1), true);
  assert.equal(BankingSystem.depositGold(player, 1), true);
  assert.equal(player.gold, 50);
  assert.equal(player.bankGold, MAX_GOLD);
});

test("loja compra em carteira + banco e reduz estoque", () => {
  const player = createPlayer();
  const npc = createMerchant();
  player.gold = 15;
  player.bankGold = 50;
  assert.equal(ShopSystem.buyItem(player, npc, potion, 3), true);
  assert.equal(player.gold, 0);
  assert.equal(player.bankGold, 35);
  assert.equal(player.inventory.get(potion), 3);
  assert.equal(npc.shopItems![0].stock, 2);
});

test("loja bloqueia valores inválidos, preço negativo e falta de estoque", () => {
  const player = createPlayer();
  const npc = createMerchant();
  player.gold = 100;
  for (const amount of invalid) {
    assert.equal(ShopSystem.buyItem(player, npc, potion, amount as number), false);
    assert.equal(ShopSystem.sellItem(player, npc, potion, amount as number), false);
  }
  assert.equal(ShopSystem.buyItem(player, npc, potion, 6), false);
  assert.equal(player.gold, 100);
  assert.equal(player.inventory.size, 0);
  npc.shopItems![0].buyPrice = -10;
  assert.equal(ShopSystem.buyItem(player, npc, potion, 1), false);
  assert.equal(player.gold, 100);
});

test("loja rejeita pagamento com overflow e preserva dinheiro/estoque", () => {
  const player = createPlayer();
  const npc = createMerchant();
  player.gold = MAX_GOLD;
  npc.shopItems![0].buyPrice = Number.MAX_SAFE_INTEGER;
  assert.equal(ShopSystem.buyItem(player, npc, potion, 3), false);
  assert.equal(player.gold, MAX_GOLD);
  assert.equal(npc.shopItems![0].stock, 5);
});

test("venda remove o item e credita gold somente com quantidade válida", () => {
  const player = createPlayer();
  const npc = createMerchant();
  assert.equal(player.addItem(potion, 3), true);
  player.gold = 10;
  assert.equal(ShopSystem.sellItem(player, npc, potion, 2), true);
  assert.equal(player.gold, 18);
  assert.equal(player.inventory.get(potion), 1);
  assert.equal(ShopSystem.sellItem(player, npc, potion, 2), false);
  assert.equal(player.gold, 18);
});

test("venda rejeita overflow do saldo e preserva item", () => {
  const player = createPlayer();
  const npc = createMerchant();
  player.inventory.set(potion, 1);
  player.gold = MAX_GOLD - 1;
  assert.equal(ShopSystem.sellItem(player, npc, potion, 1), false);
  assert.equal(player.inventory.get(potion), 1);
  assert.equal(player.gold, MAX_GOLD - 1);
});

// Contexto mínimo: permite testar os handlers sem abrir servidor ou banco real.
function createContext(world: World) {
  const errors: string[] = [];
  const packets = {
    inventory: {
      sendDropError: (message: string) => errors.push(message),
      sendPickupError: (message: string) => errors.push(message),
      sendInventory: (_player: Player) => {},
      sendEquipment: (_player: Player) => {},
    },
    loot: {
      sendLootError: (message: string) => errors.push(message),
      sendLootTaken: (_corpseId: string, _index?: number) => {},
    },
  };
  const ctx = {
    world,
    packetSender: packets,
    broadcast: {
      broadcastSpawnItemOnGround: (_item: ItemOnGround) => {},
      broadcastDespawn: (_id: string) => {},
    },
  } as unknown as HandlerContext;
  return { ctx, errors };
}
const ws = {} as WebSocket;

test("drop inválido não remove itens e não cria item no chão", async () => {
  const world = new World();
  world.generateMap(10, 10);
  const player = createPlayer();
  player.addItem(potion, 5);
  const { ctx, errors } = createContext(world);
  for (const amount of [-1, 0, 1.5, NaN, Infinity, 10]) {
    await handleDropItem(ws, player, {
      type: "dropItem", itemId: potion, amount, x: 2, y: 2,
    }, ctx);
    assert.equal(player.inventory.get(potion), 5);
    assert.equal(world.itemsOnGround.length, 0);
  }
  await handleDropItem(ws, player, {
    type: "dropItem", itemId: potion, amount: 1, x: NaN, y: 2,
  }, ctx);
  assert.equal(player.inventory.get(potion), 5);
  assert.ok(errors.length > 0);
});

test("drop e pickup válidos transferem item uma única vez", async () => {
  const world = new World();
  world.generateMap(10, 10);
  const player = createPlayer();
  player.addItem(potion, 3);
  const { ctx } = createContext(world);
  await handleDropItem(ws, player, {
    type: "dropItem", itemId: potion, amount: 2, x: 2, y: 3,
  }, ctx);
  assert.equal(player.inventory.get(potion), 1);
  assert.equal(world.itemsOnGround.length, 1);
  const groundId = world.itemsOnGround[0].id;
  await handlePickupItem(ws, player, { type: "pickupItem", itemId: groundId }, ctx);
  assert.equal(world.itemsOnGround.length, 0);
  assert.equal(player.inventory.get(potion), 3);
  await handlePickupItem(ws, player, { type: "pickupItem", itemId: groundId }, ctx);
  assert.equal(player.inventory.get(potion), 3);
});

test("pickup rejeitado por overflow mantém o item no chão", async () => {
  const world = new World();
  const player = createPlayer();
  player.gold = MAX_GOLD;
  const ground = new ItemOnGround(
    "ground-1", "currency/gold_coin", 1, 2, 2, "Gold coin",
  );
  world.addItemOnGround(ground);
  const { ctx, errors } = createContext(world);
  await handlePickupItem(ws, player, { type: "pickupItem", itemId: ground.id }, ctx);
  assert.equal(world.itemsOnGround.length, 1);
  assert.equal(player.gold, MAX_GOLD);
  assert.ok(errors.length > 0);
});

test("loot inteiro inválido não desaparece com o corpo", async () => {
  const world = new World();
  const player = createPlayer();
  player.gold = MAX_GOLD;
  const corpse = new Corpse("corpse-1", 2, 2, [
    { itemId: potion, amount: 1 },
    { itemId: "currency/gold_coin", amount: 1 },
  ]);
  world.addCorpse(corpse);
  const { ctx, errors } = createContext(world);
  await handleTakeLoot(ws, player, {
    type: "takeLoot", corpseId: corpse.id, takeAll: true,
  }, ctx);
  assert.equal(world.corpses.length, 1);
  assert.equal(corpse.loot.length, 2);
  assert.equal(player.inventory.size, 0);
  assert.ok(errors.length > 0);
});

test("loot de um item falha sem removê-lo e rejeita índices negativos", async () => {
  const world = new World();
  const player = createPlayer();
  const corpse = new Corpse("corpse-2", 2, 2, [{ itemId: potion, amount: 2 }]);
  world.addCorpse(corpse);
  const { ctx, errors } = createContext(world);
  await handleTakeLoot(ws, player, {
    type: "takeLoot", corpseId: corpse.id, takeAll: false, itemIndex: -1,
  }, ctx);
  assert.equal(corpse.loot.length, 1);
  assert.equal(player.inventory.size, 0);
  assert.ok(errors.length > 0);
});

test("loot de corpse transfere tudo e remove o cadáver", async () => {
  const world = new World();
  const player = createPlayer();
  const corpse = new Corpse("corpse-3", 2, 2, [
    { itemId: potion, amount: 3 },
    { itemId: "currency/gold_coin", amount: 5 },
  ]);
  world.addCorpse(corpse);
  const { ctx } = createContext(world);
  await handleTakeLoot(ws, player, {
    type: "takeLoot", corpseId: corpse.id, takeAll: true,
  }, ctx);
  assert.equal(player.inventory.get(potion), 3);
  assert.equal(player.gold, 5);
  assert.equal(world.corpses.length, 0);
});


test("C5: loot individual pelo indice intermediário preserva os outros itens e reajusta indices", async () => {
  const world = new World();
  world.generateMap(10,10);
  const player = createPlayer();
  world.addPlayer(player);
  const corpse = new Corpse("corpse-c5-partial", 2, 2, [
    { itemId: potion, amount: 1 },
    { itemId: potion, amount: 2 },
    { itemId: potion, amount: 3 },
  ]);
  world.addCorpse(corpse);
  const {ctx,errors}=createContext(world);
  const taken: Array<[string, number | undefined]> = [];
  const despawns:string[] = [];
  (ctx.packetSender.loot as any).sendLootTaken = (id:string,index?:number) => {
    taken.push([id,index]);
  };
  (ctx.broadcast as any).broadcastDespawn = (id:string) => despawns.push(id);

  const take = (itemIndex:number) => handleTakeLoot(ws,player,{
    type:"takeLoot",corpseId:corpse.id,takeAll:false,itemIndex,
  },ctx);

  await take(1); // selecionou o segundo item
  assert.deepEqual(corpse.loot.map(x=>x.amount),[1,3]);
  assert.equal(player.inventory.get(potion),2);
  assert.equal(world.corpses.length,1);
  assert.deepEqual(taken,[[corpse.id,1]]);
  assert.deepEqual(despawns,[]);

  await take(1); // último item agora ocupa o índice 1
  assert.deepEqual(corpse.loot.map(x=>x.amount),[1]);
  assert.equal(player.inventory.get(potion),5);
  await take(0);
  assert.equal(player.inventory.get(potion),6);
  assert.equal(world.corpses.length,0);
  assert.deepEqual(taken,[[corpse.id,1],[corpse.id,1],[corpse.id,0]]);
  assert.deepEqual(despawns,[corpse.id]);
  assert.deepEqual(errors,[]);

  // Item ou cadáver já consumido nunca pode ser coletado outra vez.
  await take(0);
  assert.equal(player.inventory.get(potion),6);
  assert.ok(errors.some(e=>e.includes("Corpse not found")));
});
