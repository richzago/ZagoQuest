import assert from "node:assert/strict";
import {test} from "node:test";
import {join} from "node:path";
import {readFileSync} from "node:fs";
import type {WebSocket} from "ws";
import type {HandlerContext} from "../src/network/handlers/HandlerContext";
import {Player} from "../src/game/entities/player";
import {World} from "../src/game/world/World";
import {Monster} from "../src/game/entities/monster";
import {Corpse} from "../src/game/entities/corpse";
import {ItemOnGround} from "../src/game/entities/itemOnGround";
import {ItemRegistry} from "../src/data/items/itemRegistry";
import {EquipmentSlot} from "../src/shared/enums/equipmentSlot.enum";
import {GroundItemPersistence} from "../src/game/systems/groundItemPersistence";
import {handleAutoLootNearby} from "../src/network/handlers/loot.handler";
import {parseClientMessage} from "../src/network/validation/messageValidation";
const simple="equipment/backpack/simple_bag",potion="consumable/health_potion";
const ws={} as WebSocket;
ItemRegistry.loadAll(join(process.cwd(),"src","data","items"));
function player(id="c15-main"){
 const p=new Player(id,id,2,2);
 p.equipment.set(EquipmentSlot.BACKPACK,simple);
 p.restoreBagState(undefined);
 return p;
}
function scene(){
 const world=new World();world.generateMap(20,20);
 const collected:string[]=[],errors:string[]=[],despawn:string[]=[];
 const ctx={world,packetSender:{
  inventory:{sendInventory:()=>collected.push("inventory")},
  loot:{sendLootError:(s:string)=>errors.push(s),
   sendLootTaken:(id:string)=>collected.push(id)},
 },broadcast:{broadcastDespawn:(id:string)=>despawn.push(id)}} as unknown as HandlerContext;
 return {world,ctx,collected,errors,despawn};
}
test("C15: transferência entre Bags preserva UUID e bloqueia ciclos, roubo, excesso de slots",()=>{
 const p=player(),root=p.equippedBagInstanceId!;
 assert.equal(p.addItem(simple,2),true);
 p.registerPurchasedBags(simple,2);
 const [a,b]=p.getVisibleBagChildren().map(x=>x.instanceId);
 assert.ok(a&&b&&a!==b&&a!==root);
 assert.equal(p.addItem(potion,10),true);
 const weight=p.getCarriedWeight();
 assert.equal(p.transferBagItem(root,a,potion,4),true);
 assert.equal(p.inventory.get(potion),6);
 assert.equal(p.transferBagItem(a,b,potion,2),true);
 assert.equal(p.bagInstances.get(b)!.items.get(potion),2);
 assert.equal(p.transferBagItem(root,a,simple,1,b),true);
 assert.equal(p.bagInstances.get(a)!.children.includes(b),true);
 assert.equal(p.transferBagItem(root,b,simple,1,a),false,
  "Bag A não pode ser colocada dentro da sua Bag filha B");
 assert.equal(p.transferBagItem(root,"uuid-de-outro-jogador",potion,1),false);
 assert.equal(p.transferBagItem(a,b,potion,99),false);
 assert.equal(p.transferBagItem(a,a,potion,1),false);
 assert.equal(p.transferBagItem(a,root,simple,1,"falso"),false);
 assert.equal(p.getCarriedWeight(),weight);
 const saved=p.exportBagState(),copy=new Player("clone","clone",2,2);
 copy.equipment=new Map(p.equipment);
 copy.restoreBagState(JSON.parse(JSON.stringify(saved)));
 assert.equal(copy.bagInstances.get(a)?.children.includes(b),true);
 assert.equal(copy.bagInstances.get(b)?.items.get(potion),2);
});
test("C15: snapshot do chão preserva itens e árvore Bag, bloqueia IDs repetidos",()=>{
 const world=new World();world.generateMap(20,20);
 const bag=new ItemOnGround("ground-bag-id",simple,1,2,3,"Simple Bag");
 bag.bagState={equippedId:"bag-uuid",bags:[
  {id:"bag-uuid",itemId:simple,items:{[potion]:2},children:["child-uuid"]},
  {id:"child-uuid",itemId:simple,items:{},children:[]},
 ]};
 world.addItemOnGround(bag);
 world.addItemOnGround(new ItemOnGround("ground-potion-id",potion,3,4,2,"Potion"));
 const serialized=GroundItemPersistence.serialize(world);
 const restarted=new World();restarted.generateMap(20,20);
 const restored=GroundItemPersistence.parse(JSON.parse(JSON.stringify(serialized)),restarted);
 assert.equal(restored.length,2);
 assert.equal(restored[0].id,bag.id);
 assert.equal(restored[0].bagState?.equippedId,"bag-uuid");
 assert.equal(restored[0].bagState?.bags[0].children[0],"child-uuid");
 assert.equal(restored[1].amount,3);
 assert.throws(()=>GroundItemPersistence.parse([...serialized,serialized[0]],restarted));
 assert.throws(()=>GroundItemPersistence.parse(
  [{id:"invalid",itemId:potion,amount:1,x:300,y:300,itemName:"P"}],restarted));
});
test("C15: maior hit é golpe único efetivo, não soma de hits",()=>{
 const m=new Monster("m" as string,{name:"Test",stats:{hp:100},combat:{xp:12}} as any,2,2,
   {update:()=>{}} as any);
 m.recordPlayerDamage("a",12);m.recordPlayerDamage("a",12);
 m.recordPlayerDamage("b",20);
 assert.equal(m.damageByPlayer.get("a"),24);
 assert.equal(m.maxHitByPlayer.get("a"),12);
 assert.equal(m.maxHitByPlayer.get("b"),20);
});
test("C15: auto-loot respeita maior hit por corpse e box 3x3, sem escolher ID",()=>{
 const {world,ctx,collected,despawn}=scene();
 const p=player();world.addPlayer(p);
 for (const [id,x,y,owner] of [
  ["mine-1",2,3,p.id],["mine-2",3,2,p.id],["someone-else",2,1,"other"],
  ["mine-far",4,2,p.id],
 ] as const){
  const c=new Corpse(id,x,y,[{itemId:potion,amount:2}]);
  c.lootOwnerId=owner;world.addCorpse(c);
 }
 assert.equal(parseClientMessage(JSON.stringify({type:"autoLootNearby"})).ok,true);
 assert.equal(parseClientMessage(JSON.stringify({type:"autoLootNearby",corpseId:"someone-else"})).ok,false);
 handleAutoLootNearby(ws,p,{type:"autoLootNearby"},ctx);
 assert.equal(p.inventory.get(potion),4);
 assert.deepEqual(world.corpses.map(c=>c.id),["someone-else","mine-far"]);
 assert.deepEqual(despawn.sort(),["mine-1","mine-2"]);
 assert.ok(collected.includes("inventory"));
});
test("C15: auto-loot não coleta se CAP insuficiente e preserva cadáver",()=>{
 const {world,ctx,errors}=scene();
 const p=player();world.addPlayer(p);
 assert.equal(p.addItem(potion,129),true);
 const corpse=new Corpse("heavy",3,2,[{itemId:potion,amount:1}]);
 corpse.lootOwnerId=p.id;world.addCorpse(corpse);
 handleAutoLootNearby(ws,p,{type:"autoLootNearby"},ctx);
 assert.equal(p.inventory.get(potion),129);
 assert.equal(world.corpses[0],corpse);
 assert.ok(errors.some(s=>/CAP/.test(s)));
});
test("C15: contrato Unity para scroll wheel, drag da barra e envio sem UUID nulo",()=>{
 const src=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
 assert.match(src("UI/C8SidebarDynamicDock.cs"),/EnsureVerticalScrollbar\(bagScroll/);
 assert.match(src("UI/C8SidebarDynamicDock.cs"),/EnsureVerticalScrollbar\(scroll/);
 assert.match(src("UI/C8SidebarDynamicDock.cs"),/bar\.handleRect = hr/);
 assert.match(src("UI/C8SidebarDynamicDock.cs"),/scroll\.verticalScrollbar =/);
 assert.match(src("Player/InventorySlot.cs"),/TransferBagItem\(/);
 assert.match(src("Networking/Senders/InventorySender.cs"),/TransferBagItemWithoutInstanceMessage/);
 assert.match(src("UI/LootUI.cs"),/SendAutoLootNearby\(\)/);
});
