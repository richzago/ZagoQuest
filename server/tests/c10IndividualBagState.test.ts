import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { WebSocket } from "ws";
import { Player } from "../src/game/entities/player";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { World } from "../src/game/world/World";
import { Npc } from "../src/game/entities/npc";
import { Corpse } from "../src/game/entities/corpse";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { handleDropItem, handlePickupItem } from "../src/network/handlers/inventory.handler";
import { handleTakeLoot } from "../src/network/handlers/loot.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";

const basic="equipment/backpack/basic_backpack";
const simple="equipment/backpack/simple_bag";
const potion="consumable/health_potion";
const ws={} as WebSocket;
const root=join(process.cwd(),"src","data");
function init():void { ItemRegistry.loadAll(join(root,"items")); }
function makePlayer():Player {
  init();
  const p=new Player("c10-player","C10",2,2);
  p.gold=1000;
  return p;
}
function merchant():Npc {
  const config=JSON.parse(readFileSync(join(root,"npc","merchant.json"),"utf8"));
  const n=new Npc("c10-merchant","Merchant",2,3,"Oi","merchant");
  n.shopItems=config.shopItems;return n;
}
function context(world:World) {
  const errors:string[]=[];
  const emitted:any[]=[];
  const ctx={
    world,
    packetSender:{
      inventory:{
        sendInventory:()=>emitted.push("inventory"),
        sendEquipment:()=>emitted.push("equipment"),
        sendPickupError:(v:string)=>errors.push(v),
        sendDropError:(v:string)=>errors.push(v),
      },
      loot:{
        sendLootError:(v:string)=>errors.push(v),
        sendLootTaken:(id:string,index?:number)=>emitted.push(["lootTaken",id,index]),
      },
    },
    broadcast:{
      broadcastSpawnItemOnGround:()=>emitted.push("spawn"),
      broadcastDespawn:()=>emitted.push("despawn"),
    },
  } as unknown as HandlerContext;
  return {ctx,errors,emitted};
}

test("C10: sem Bag, Merchant recusa poções SEM gastar ouro; primeira Bag abre inventário vazio",()=>{
 const p=makePlayer(),n=merchant();
 assert.equal(ShopSystem.buyItem(p,n,potion,1),false);
 assert.equal(p.gold,1000);
 assert.equal(p.inventory.size,0);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(p.equipment.get(EquipmentSlot.BACKPACK),simple);
 assert.equal(p.getContainerCapacity(),10);
 assert.equal(p.inventory.size,0);
 assert.equal(ShopSystem.buyItem(p,n,potion,1),true);
 assert.equal(p.inventory.get(potion),1);
});

test("C10: nova Bag não herda itens da Bag largada; recolha restaura conteúdo original",async()=>{
 const p=makePlayer(),n=merchant();
 const world=new World();world.generateMap(12,12);
 assert.equal(ShopSystem.buyItem(p,n,basic,1),true);
 assert.equal(p.addItem(potion,7),true);
 assert.equal(p.getContainerSlotsUsed(),1);
 const {ctx,errors}=context(world);
 await handleDropItem(ws,p,{
   type:"dropItem",itemId:basic,amount:1,x:2,y:3,fromEquipment:true,
 },ctx);
 assert.deepEqual(errors,[]);
 assert.equal(p.equipment.has(EquipmentSlot.BACKPACK),false);
 assert.equal(p.inventory.has(potion),false);
 assert.equal(world.itemsOnGround.length,1);
 const ground=world.itemsOnGround[0];
 assert.equal(ground.bagState?.bags[0].items[potion],7);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(p.equipment.get(EquipmentSlot.BACKPACK),simple);
 assert.equal(p.inventory.has(potion),false);
 assert.equal(p.getContainerSlotsUsed(),0);
 await handlePickupItem(ws,p,{type:"pickupItem",itemId:ground.id},ctx);
 assert.equal(p.inventory.get(basic),1);
 assert.equal(p.inventory.has(potion),false,"old items remain inside original bag instance");
 assert.equal(p.equipItem(basic),true);
 assert.equal(p.inventory.get(potion),7);
 assert.equal(p.inventory.get(simple),1);
 assert.equal(p.getContainerCapacity(),20);
 assert.equal(world.itemsOnGround.length,0);
});

test("C10: Bags iguais têm UUIDs distintos; troca não move conteúdo, salvar/restaurar mantém associação",()=>{
 const p=makePlayer(),n=merchant();
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(p.addItem(potion,5),true);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(p.inventory.get(simple),1);
 assert.equal(p.equipItem(simple),true);
 assert.equal(p.inventory.has(potion),false,"second simple bag begins empty");
 assert.equal(p.inventory.get(simple),1,"old bag is nested with its own content");
 const state=p.exportBagState();
 assert.equal(state.bags.length,2);
 assert.equal(new Set(state.bags.map(b=>b.id)).size,2);
 const clone=new Player("c10-player","AfterLogin",2,2);
 clone.equipment=new Map(p.equipment);
 clone.inventory=new Map(p.inventory);
 clone.restoreBagState(JSON.parse(JSON.stringify(state)));
 assert.equal(clone.equippedBagInstanceId,p.equippedBagInstanceId);
 assert.equal(clone.inventory.has(potion),false);
 assert.equal(clone.equipItem(simple),true,"swap back to prior bag");
 assert.equal(clone.inventory.get(potion),5);
 const next=clone.exportBagState();
 assert.equal(next.bags.length,2);
});

test("C10: tentativa de vender Bag cheia não apaga itens por dentro",()=>{
 const p=makePlayer(),n=merchant();
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(ShopSystem.buyItem(p,n,basic,1),true);
 assert.equal(p.equipItem(basic),true);
 // Simple Bag guardada dentro da Basic Backpack ainda está vazia.
 assert.equal(p.inventory.get(simple),1);
 assert.equal(ShopSystem.sellItem(p,n,simple,1),true);
 assert.equal(p.inventory.has(simple),false);
 // Agora uma Bag com conteúdos não pode ser vendida do interior de outra Bag.
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(p.equipItem(simple),true);
 assert.equal(p.addItem(potion,2),true);
 assert.equal(p.equipItem(basic),true);
 assert.equal(p.inventory.get(simple),1);
 const gold=p.gold;
 assert.equal(ShopSystem.sellItem(p,n,simple,1),false);
 assert.equal(p.gold,gold);
 assert.equal(p.inventory.get(simple),1);
});

test("C10: loot clique e take-all respeitam slots atuais e ACK do Node",async()=>{
 const p=makePlayer(),n=merchant();
 const world=new World();world.generateMap(12,12);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 const corpse=new Corpse("corpse-c10",2,3,[
   {itemId:potion,amount:2},
   {itemId:basic,amount:1},
   {itemId:potion,amount:3},
 ]);
 world.addCorpse(corpse);
 const {ctx,errors,emitted}=context(world);
 await handleTakeLoot(ws,p,{type:"takeLoot",corpseId:corpse.id,takeAll:false,itemIndex:1},ctx);
 assert.equal(p.inventory.get(basic),1);
 assert.equal(corpse.loot.length,2);
 assert.ok(emitted.some(v=>Array.isArray(v)&&v[0]==="lootTaken"&&v[2]===1));
 await handleTakeLoot(ws,p,{type:"takeLoot",corpseId:corpse.id,takeAll:true},ctx);
 assert.equal(p.inventory.get(potion),5);
 assert.equal(world.corpses.length,0);
 assert.deepEqual(errors,[]);
});

test("C10 UI: gear configurável com 3 colunas, hotkey Shift+L, host real e camera única",()=>{
 const read=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
 const prefs=read("UI/C10ClientLayoutSettings.cs");
 const dock=read("UI/C8SidebarDynamicDock.cs");
 const shell=read("UI/C8SidebarShell.cs");
 const camera=read("UI/C8PlayfieldViewport.cs");
 const loot=read("UI/LootUI.cs");
 assert.match(prefs,/LeftColumns => Mathf\.Clamp\(PlayerPrefs\.GetInt/);
 assert.match(prefs,/RightColumns => Mathf\.Clamp\(PlayerPrefs\.GetInt/);
 assert.match(prefs,/private void WireGear\(/);
 assert.match(prefs,/BagHost/);assert.match(prefs,/LootHost/);
 assert.match(prefs,/GetPixelMargins\(out float left,out float right\)/);
 assert.match(prefs,/GetComponent<C8SidebarDynamicDock>\(\)\?\.ReturnToPrimaryHost\(\)/);
 assert.match(shell,/public void ApplyClientDensity\(\)/);
 assert.match(dock,/ResolveHosts\(\)/);
 assert.match(dock,/public void ReturnToPrimaryHost\(\)/);
 assert.match(loot,/public void TakeAllLoot\(\)/);
 assert.match(loot,/k\.lKey\.wasPressedThisFrame/);
 assert.match(loot,/k\.leftShiftKey\.isPressed/);
 assert.match(camera,/worldCamera\.rect = new Rect\(viewportStart, 0f, viewportWidth, 1f\)/);
 assert.doesNotMatch(camera,/new Camera\(/);
});
