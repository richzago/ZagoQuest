import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";

const root = join(process.cwd(), "src", "data");
const simple = "equipment/backpack/simple_bag";
const basic = "equipment/backpack/basic_backpack";
const merchant = JSON.parse(readFileSync(join(root, "npc", "merchant.json"), "utf8"));
function setup(): void { ItemRegistry.loadAll(join(root, "items")); }
function buyer(name: string): Player {
  const p = new Player("c9-" + name, name, 1, 2);
  p.gold = 1000;
  p.bankGold = 0;
  return p;
}
function npc(): Npc {
  const n = new Npc("merchant-c9", "Merchant", 1, 1, "Hello", "merchant");
  n.shopItems = merchant.shopItems;
  return n;
}

test("C9: slots configurados diretamente no JSON de cada item", () => {
  setup();
  assert.equal(ItemRegistry.get(simple).containerSlots, 10);
  assert.equal(ItemRegistry.get(basic).containerSlots, 20);
  assert.equal(ItemRegistry.get(simple).slot, EquipmentSlot.BACKPACK);
  assert.equal(ItemRegistry.get(basic).slot, EquipmentSlot.BACKPACK);
  const simpleOffer = merchant.shopItems.find((x:{itemId:string})=>x.itemId===simple);
  assert.deepEqual(simpleOffer, {itemId:simple,buyPrice:20,sellPrice:8});
  const basicOffer = merchant.shopItems.find((x:{itemId:string})=>x.itemId===basic);
  assert.deepEqual(basicOffer, {itemId:basic,buyPrice:35,sellPrice:15});
});

test("C9: sem Bag equipada a coleta de corpo/chão é rejeitada até para gold", () => {
  setup();
  const p=buyer("empty");
  assert.equal(p.getContainerCapacity(),0);
  assert.equal(p.getContainerItemId(),null);
  assert.equal(p.canCollectItems([{itemId:"consumable/health_potion", amount:1}]),false);
  assert.equal(p.canCollectItems([{itemId:"currency/gold_coin", amount:10}]),false);
  assert.equal(p.getContainerSlotsUsed(),0);
});

test("C9: primeira Simple Bag comprada é equipada; 10 slots e venda com preço real", () => {
  setup();
  const p=buyer("simple"), n=npc();
  assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
  assert.equal(p.gold,980);
  assert.equal(p.equipment.get(EquipmentSlot.BACKPACK),simple);
  assert.equal(p.getContainerItemId(),simple);
  assert.equal(p.getContainerCapacity(),10);
  assert.equal(p.canCollectItems([{itemId:"consumable/health_potion",amount:1}]),true);
  assert.equal(p.unequipItem(EquipmentSlot.BACKPACK),true);
  assert.equal(p.getContainerCapacity(),0);
  assert.equal(ShopSystem.sellItem(p,n,simple,1),true);
  assert.equal(p.gold,988);
});

test("C9: 10 slots preenchidos recusa item 11; pilhas empilham e moedas viram gold", () => {
  setup();
  const p=buyer("full");
  p.equipment.set(EquipmentSlot.BACKPACK,simple);
  const item="consumable/health_potion";
  const other="consumable/mana_potion";
  // C18: 40 potions ocupam 4 pilhas (maxStack=10).
  assert.equal(p.canCollectItems([{itemId:item,amount:40}]),true);
  p.inventory.set(item,40);
  assert.equal(p.getContainerSlotsUsed(),4);
  assert.equal(p.canCollectItems([{itemId:item,amount:10}]),true);
  assert.equal(p.canCollectItems([{itemId:other,amount:1}]),true);
  assert.equal(p.canCollectItems([{itemId:"currency/gold_coin",amount:100}]),true);
  // Seis unidades não-stackable + 4 pilhas lotam os dez slots.
  const nonstack=basic;
  p.inventory.set(nonstack,6);
  assert.equal(p.getContainerSlotsUsed(),10);
  assert.equal(p.canCollectItems([{itemId:other,amount:1}]),false);
  assert.equal(p.canCollectItems([{itemId:item,amount:3}]),false);
  assert.equal(p.canCollectItems([{itemId:nonstack,amount:2}]),false);
});

test("C9: Basic Backpack tem 20 slots, troca respeita configuração e não apaga itens legados", () => {
  setup();
  const p=buyer("swap");
  p.equipment.set(EquipmentSlot.BACKPACK,simple);
  p.inventory.set(basic,12);
  assert.equal(p.getContainerSlotsUsed(),12);
  assert.equal(p.canCollectItems([{itemId:"consumable/mana_potion",amount:1}]),false);
  // Upgrade direto aqui simula estado autorizado por equipItem; nenhum item apagado.
  p.equipment.set(EquipmentSlot.BACKPACK,basic);
  assert.equal(p.getContainerCapacity(),20);
  assert.equal(p.canCollectItems([{itemId:"consumable/mana_potion",amount:1}]),true);
  p.equipment.delete(EquipmentSlot.BACKPACK);
  assert.equal(p.getContainerCapacity(),0);
  assert.equal(p.inventory.get(basic),12);
  assert.equal(p.canCollectItems([{itemId:"consumable/mana_potion",amount:1}]),false);
});

test("C9: lote de loot é validado por inteiro e rejeita quantidades inválidas", () => {
  setup();
  const p=buyer("batch");
  p.equipment.set(EquipmentSlot.BACKPACK,simple);
  p.inventory.set(basic,9);
  assert.equal(p.canCollectItems([
    {itemId:"consumable/health_potion",amount:1},
    {itemId:"consumable/mana_potion",amount:1},
  ]),false);
  assert.equal(p.canCollectItems([{itemId:"consumable/health_potion",amount:-1}]),false);
  assert.equal(p.canCollectItems([{itemId:"consumable/health_potion",amount:0}]),false);
  assert.equal(p.canCollectItems([{itemId:"consumable/health_potion",amount:1}]),true);
});
