import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { WebSocket } from "ws";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { ItemOnGround } from "../src/game/entities/itemOnGround";
import { World } from "../src/game/world/World";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { handleDropItem, handlePickupItem } from "../src/network/handlers/inventory.handler";
import { InventorySender } from "../src/network/senders/inventorySender";
import { canDropOnWorldTile } from "../src/game/systems/worldDropRules";

const simple="equipment/backpack/simple_bag";
const potion="consumable/health_potion";
const ws={} as WebSocket;
const unity=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
ItemRegistry.loadAll(join(process.cwd(),"src","data","items"));

function setup() {
  const p=new Player("c14-player","C14 Hero",2,2);
  const world=new World(); world.generateMap(30,30); world.addPlayer(p);
  const errors:string[]=[]; const packets:unknown[]=[];
  const ctx={world,packetSender:{inventory:{
    sendInventory:()=>packets.push("inventory"),sendEquipment:()=>packets.push("equipment"),
    sendPickupError:(m:string)=>errors.push(m),sendDropError:(m:string)=>errors.push(m),
    sendError:(m:string)=>errors.push(m),
  }},broadcast:{
    broadcastSpawnItemOnGround:()=>packets.push("ground-spawn"),
    broadcastDespawn:()=>packets.push("despawn"),
  }} as unknown as HandlerContext;
  const merchant=new Npc("c14-merchant","Merchant",2,3,"hello","merchant");
  merchant.shopItems=[{itemId:simple,buyPrice:10,sellPrice:5}];
  p.gold=5000;
  return {p,world,ctx,merchant,errors,packets};
}

test("C14: Bag antiga volta do chão para a Bag NOVA e abre pelo mesmo UUID",async()=>{
  const {p,world,ctx,merchant,errors}=setup();
  assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
  const oldId=p.equippedBagInstanceId;
  assert.ok(oldId);
  assert.equal(p.addItem(potion,3),true);
  await handleDropItem(ws,p,{type:"dropItem",itemId:simple,amount:1,
    fromEquipment:true,x:2,y:3},ctx);
  assert.equal(world.itemsOnGround.length,1);
  assert.equal(world.itemsOnGround[0].bagState?.equippedId,oldId);
  assert.equal(p.equipment.has(EquipmentSlot.BACKPACK),false);
  assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
  const newId=p.equippedBagInstanceId;
  assert.ok(newId && newId!==oldId);
  const groundId=world.itemsOnGround[0].id;
  await handlePickupItem(ws,p,{type:"pickupItem",itemId:groundId},ctx);
  assert.equal(world.itemsOnGround.length,0);
  assert.deepEqual(errors,[]);
  const rows=p.getVisibleBagChildren();
  assert.deepEqual(rows,[{instanceId:oldId,itemId:simple}]);
  assert.equal(p.openNestedBag(simple,oldId!),true);
  assert.equal(p.inventory.get(potion),3);
  assert.equal(p.closeNestedBag(),true);
  assert.equal(p.equippedBagInstanceId,newId);
  assert.equal(p.inventory.get(simple),1);
  const copy=new Player("c14-clone","Clone",2,2);
  copy.equipment=new Map(p.equipment);
  copy.restoreBagState(JSON.parse(JSON.stringify(p.exportBagState())));
  assert.equal(copy.openNestedBag(simple,oldId!),true);
  assert.equal(copy.inventory.get(potion),3);
});

test("C14: CAP considera equipamentos, peso JSON e conteúdo oculto de Bags",()=>{
  const {p,merchant}=setup();
  assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
  assert.equal(p.getMaxCarryWeight(),400);
  assert.equal(ItemRegistry.get(simple).weight,12);
  assert.equal(ItemRegistry.get(potion).weight,3);
  assert.equal(p.getCarriedWeight(),12);
  assert.equal(p.addItem(potion,129),true); // 12 + 387 = 399
  assert.equal(p.getCarriedWeight(),399);
  assert.equal(p.getRemainingCap(),1);
  assert.equal(p.canCollectItems([{itemId:potion,amount:1}]),false);
  assert.equal(p.addItem(potion,1),false);
  assert.equal(p.inventory.get(potion),129);
  assert.equal(p.removeItem(potion,100),true);
  assert.equal(p.getRemainingCap(),301);
  p.level=10; assert.equal(p.getMaxCarryWeight(),490);
});

test("C14: CAP impede take-all acima do peso e não altera pilha no erro",()=>{
 const {p,merchant}=setup();
 assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
 assert.equal(p.addItem(potion,10),true);
 const initial=p.getCarriedWeight();
 assert.equal(p.canCollectItems([{itemId:potion,amount:70},
   {itemId:potion,amount:70}]),false); // 30 + 420 + bag > CAP
 assert.equal(p.getCarriedWeight(),initial);
 assert.equal(p.inventory.get(potion),10);
});

test("C14: recusar pickup de Bag cheia além do CAP sem perder UUID/objeto",async()=>{
 const {p,merchant,world,ctx,errors}=setup();
 assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
 const heavy=new ItemOnGround("c14-heavy",simple,1,2,3,"Bag pesada");
 heavy.bagState={equippedId:"root-heavy",bags:[{
    id:"root-heavy",itemId:simple,items:{[potion]:200},children:[],
 }]};
 world.addItemOnGround(heavy);
 await handlePickupItem(ws,p,{type:"pickupItem",itemId:heavy.id},ctx);
 assert.equal(world.getItemOnGround(heavy.id),heavy);
 assert.equal(p.getVisibleBagChildren().length,0);
 assert.ok(errors.length>0);
});

test("C14: visão aceita tile distante válido e recusa paredes/água/ocupados",()=>{
 const {p,world}=setup();
 assert.equal(canDropOnWorldTile(world,p,10,2),true);
 assert.equal(canDropOnWorldTile(world,p,2,8),true);
 assert.equal(canDropOnWorldTile(world,p,11,2),false);
 assert.equal(canDropOnWorldTile(world,p,2,9),false);
 assert.equal(canDropOnWorldTile(world,p,5,5),false);
 assert.equal(canDropOnWorldTile(world,p,30,2),false);
 world.getTile(4,2)!.walkable=false;
 assert.equal(canDropOnWorldTile(world,p,8,2),false);
 world.getTile(4,2)!.walkable=true;
 const occupied=new Npc("c14-occupied","Occupant",8,2,"hello","npc");
 world.addNpc(occupied);
 assert.equal(canDropOnWorldTile(world,p,8,2),false);
});

test("C14: pacotes de CAP na HUD, clique em UUID e novo alcance nos dois clientes",()=>{
 const {p,merchant}=setup();assert.equal(ShopSystem.buyItem(p,merchant,simple,1),true);
 const sender=new InventorySender(ws),packets:any[]=[];
 (sender as any).send=(payload:unknown)=>packets.push(payload);
 sender.sendInventory(p);
 assert.equal(packets[0].capMax,400);
 assert.equal(packets[0].capRemaining,388);
 assert.equal(packets[0].capUsed,12);
 const handler=unity("Networking/Handlers/InventoryHandler.cs");
 assert.match(handler,/C8SidebarShell\.SetCapacity\(invMsg\.capRemaining, invMsg\.capMax\)/);
 const shell=unity("UI/C8SidebarShell.cs");
 assert.match(shell,/C14CapacityLabel/);
 assert.match(shell,/capLabel\.raycastTarget = false/);
 const slot=unity("Player/InventorySlot.cs");
 assert.match(slot,/OnBagOpen\?\.Invoke\(itemId, bagInstanceId\)/);
 const drag=unity("Managers/DragDropManager.cs");
 assert.match(drag,/dx > 8 \|\| dy > 6/);
 const loot=unity("UI/LootUI.cs");
 assert.match(loot,/dx > 8 \|\| dy > 6/);
});
