/** UI2B QA: mochila real no catálogo, compra, venda e slot de equipamento. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { ShopSystem } from "../src/game/systems/shopSystem";

const root = join(process.cwd(), "src", "data");
const merchant = JSON.parse(readFileSync(join(root,"npc","merchant.json"),"utf8"));
const backpackId = "equipment/backpack/basic_backpack";

test("UI2B Merchant: item Backpack é definido, cadastrado e negociável nos dois sentidos", () => {
 ItemRegistry.loadAll(join(root,"items"));
 const backpack = ItemRegistry.get(backpackId);
 assert.equal(backpack.id, backpackId);
 assert.equal(backpack.name, "Backpack");
 assert.equal(backpack.type, "equipment");
 assert.equal(backpack.stackable, false);
 assert.equal(backpack.slot, EquipmentSlot.BACKPACK);
 const offer = merchant.shopItems.find((entry:{itemId:string})=> entry.itemId === backpackId);
 assert.deepEqual(offer, {itemId:backpackId,buyPrice:35,sellPrice:15});
 assert.ok(offer.buyPrice > offer.sellPrice);
 assert.equal(merchant.type, "merchant");
});

test("UI2B: comprar, equipar, desequipar e revender Backpack sem lucro infinito", () => {
 ItemRegistry.loadAll(join(root,"items"));
 const npc = new Npc("merchant-test","Merchant",1,1,"Hello","merchant");
 npc.shopItems = merchant.shopItems;
 const player = new Player("backpack-qa","QA",1,2);
 player.gold = 100;
 player.bankGold = 0;
 assert.equal(ShopSystem.buyItem(player,npc,backpackId,1),true);
 assert.equal(player.gold,65);
 // C9: primeira Bag/Backpack comprada equipa automaticamente para desbloquear acesso.
 assert.equal(player.equipment.get(EquipmentSlot.BACKPACK),backpackId);
 assert.equal(player.getContainerCapacity(),20);
 assert.equal(player.inventory.has(backpackId),false);
 assert.equal(player.inventory.has(backpackId),false);
 assert.equal(player.unequipItem(EquipmentSlot.BACKPACK),true);
 assert.equal(player.inventory.get(backpackId),1);
 assert.equal(ShopSystem.sellItem(player,npc,backpackId,1),true);
 assert.equal(player.inventory.has(backpackId),false);
 assert.equal(player.gold,80);
 assert.equal(ShopSystem.sellItem(player,npc,backpackId,1),false);
 assert.equal(player.gold,80);
 assert.equal(ShopSystem.buyItem(player,npc,backpackId,0),false);
 assert.equal(ShopSystem.buyItem(player,npc,backpackId,-1),false);
 assert.equal(player.gold,80);
});

test("UI2B Merchant: sem gold suficiente, Backpack não é entregue",()=>{
 ItemRegistry.loadAll(join(root,"items"));
 const npc = new Npc("merchant-test","Merchant",1,1,"Hello","merchant");
 npc.shopItems = merchant.shopItems;
 const player = new Player("no-gold","Tester",1,2);
 player.gold = 34;
 player.bankGold = 0;
 assert.equal(ShopSystem.buyItem(player,npc,backpackId,1),false);
 assert.equal(player.gold,34);
 assert.equal(player.inventory.has(backpackId),false);
});
