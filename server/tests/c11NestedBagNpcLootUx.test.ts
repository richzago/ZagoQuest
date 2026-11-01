import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Npc } from "../src/game/entities/npc";
import { Player } from "../src/game/entities/player";
import { ItemOnGround } from "../src/game/entities/itemOnGround";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { handlePickupItem, handleDropItem } from "../src/network/handlers/inventory.handler";
import { handleOpenBag, handleCloseBag } from "../src/network/handlers/inventory.handler";
import { handleOpenShop } from "../src/network/handlers/shop.handler";
import { parseClientMessage } from "../src/network/validation/messageValidation";
import { InventorySender } from "../src/network/senders/inventorySender";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";

const simple="equipment/backpack/simple_bag";
const potion="consumable/health_potion";
const ws={} as WebSocket;
const root=join(process.cwd(),"src","data");
const unity=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
function player():Player {
  ItemRegistry.loadAll(join(root,"items"));
  return new Player("c11-test","C11 Player",2,2);
}
function merchant():Npc {
  const data=JSON.parse(readFileSync(join(root,"npc","merchant.json"),"utf8"));
  const n=new Npc("c11-merchant","Mercador",2,3,"Olá","merchant");
  n.shopItems=data.shopItems;
  return n;
}
function scene() {
  const world=new World();world.generateMap(15,15);
  const errors:string[]=[]; const responses:unknown[]=[];
  const ctx={
    world,packetSender:{
      inventory:{
        sendInventory:()=>responses.push("inventory"),
        sendEquipment:()=>responses.push("equipment"),
        sendPickupError:(message:string)=>errors.push(message),
        sendDropError:(message:string)=>errors.push(message),
        sendError:(message:string)=>errors.push(message),
      },
      shop:{
        sendShopWindow:(...args:unknown[])=>responses.push(["shopWindow",...args]),
        sendShopError:(message:string)=>errors.push(message),
      },
    },
    broadcast:{
      broadcastDespawn:()=>responses.push("despawn"),
      broadcastSpawnItemOnGround:()=>responses.push("spawn"),
    },
  } as unknown as HandlerContext;
  return {world,ctx,errors,responses};
}
test("C11: NPC sobre ItemOnGround próximo tem autorização de Merchant; distante é recusado sem abrir",async()=>{
  const s=scene(),p=player(),n=merchant();
  s.world.addPlayer(p);s.world.addNpc(n);
  s.world.addItemOnGround(new ItemOnGround("item-ao-lado",potion,1,2,3,"Poção"));
  await handleOpenShop(ws,p,{type:"openShop",npcId:n.id},s.ctx);
  assert.equal(s.errors.length,0);
  assert.equal(s.responses.filter(x=>Array.isArray(x)&&x[0]==="shopWindow").length,1);
  p.position.x=12;
  await handleOpenShop(ws,p,{type:"openShop",npcId:n.id},s.ctx);
  assert.equal(s.responses.filter(x=>Array.isArray(x)&&x[0]==="shopWindow").length,1);
  assert.match(s.errors[0],/Aproxime-se/);
});
test("C11: segunda Bag idêntica no chão vai para dentro da equipada e não mistura conteúdos",async()=>{
  const s=scene(),p=player(),n=merchant();p.gold=1000;
  assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
  assert.equal(p.addItem(potion,3),true);
  const ground=new ItemOnGround("ground-second-bag",simple,1,2,3,"Simple Bag");
  s.world.addItemOnGround(ground);
  await handlePickupItem(ws,p,{type:"pickupItem",itemId:ground.id},s.ctx);
  assert.deepEqual(s.errors,[]);
  assert.equal(s.world.itemsOnGround.length,0);
  assert.equal(p.inventory.get(simple),1);
  assert.equal(p.inventory.get(potion),3);
  assert.equal(p.getContainerSlotsUsed(),2);
  assert.equal(p.equipment.get(EquipmentSlot.BACKPACK),simple);
  const state=p.exportBagState();
  assert.equal(state.bags.length,2);
  assert.equal(new Set(state.bags.map(b=>b.id)).size,2);
  assert.equal(p.openNestedBag(simple),true);
  assert.equal(p.inventory.size,0,"nova Bag dentro da antiga começa vazia");
  assert.equal(p.addItem(potion,4),true);
  assert.equal(p.closeNestedBag(),true);
  assert.equal(p.inventory.get(potion),3,"conteúdo da Bag principal não herda 4 poções");
  assert.equal(p.exportBagState().bags.find(b=>b.id!==p.equippedBagInstanceId)?.items[potion],4);
  const clone=new Player("c11-test","Restaurado",2,2);
  clone.equipment=new Map(p.equipment);
  clone.inventory=new Map(p.inventory);
  clone.restoreBagState(JSON.parse(JSON.stringify(p.exportBagState())));
  assert.equal(clone.openNestedBag(simple),true);
  assert.equal(clone.inventory.get(potion),4);
});
test("C11: 10 Bags em uma Simple Bag, 11a é recusada sem perda e cabe na primeira Bag filha",async()=>{
  const s=scene(),p=player(),n=merchant();p.gold=1000;
  assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
  for(let i=0;i<10;i++){
    const id="nested-"+i;
    s.world.addItemOnGround(new ItemOnGround(id,simple,1,2,3,"Simple Bag"));
    await handlePickupItem(ws,p,{type:"pickupItem",itemId:id},s.ctx);
    assert.equal(s.world.getItemOnGround(id),undefined,`Bag número ${i+1} não coletada`);
  }
  assert.equal(p.getContainerSlotsUsed(),10);
  assert.equal(p.inventory.get(simple),10);
  assert.equal(p.exportBagState().bags.length,11);
  s.world.addItemOnGround(new ItemOnGround("nested-eleven",simple,1,2,3,"Simple Bag"));
  await handlePickupItem(ws,p,{type:"pickupItem",itemId:"nested-eleven"},s.ctx);
  assert.ok(s.world.getItemOnGround("nested-eleven"));
  assert.equal(p.bagInstances.size,11,"tentativa negada não vaza UUID ou duplica Bag");
  assert.ok(s.errors.some(x=>/cheia/.test(x)));
  assert.equal(p.openNestedBag(simple),true);
  assert.equal(p.getContainerCapacity(),10);
  assert.equal(p.getContainerSlotsUsed(),0);
  await handlePickupItem(ws,p,{type:"pickupItem",itemId:"nested-eleven"},s.ctx);
  assert.equal(s.world.getItemOnGround("nested-eleven"),undefined);
  assert.equal(p.getContainerSlotsUsed(),1);
  assert.equal(p.exportBagState().bags.length,12);
  assert.equal(p.closeNestedBag(),true);
  assert.equal(p.inventory.get(simple),10);
  assert.equal(p.getContainerSlotsUsed(),10);
});
test("C11: openBag/closeBag são validados (sem UUID de terceiros nem navegação inexistente)",()=>{
 const s=scene(),p=player(),n=merchant();p.gold=1000;
 assert.equal(parseClientMessage(JSON.stringify({type:"openBag",itemId:simple})).ok,true);
 assert.equal(parseClientMessage(JSON.stringify({type:"closeBag"})).ok,true);
 assert.equal(parseClientMessage(JSON.stringify({type:"openBag",itemId:simple,characterId:"victim"})).ok,false);
 assert.equal(parseClientMessage(JSON.stringify({type:"openBag",itemId:4})).ok,false);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 handleOpenBag(ws,p,{type:"openBag",itemId:simple},s.ctx);
 assert.ok(s.errors.some(x=>/Não foi possível abrir/.test(x)));
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 handleOpenBag(ws,p,{type:"openBag",itemId:simple},s.ctx);
 assert.equal(p.isViewingNestedBag,true);
 handleCloseBag(ws,p,{type:"closeBag"},s.ctx);
 assert.equal(p.isViewingNestedBag,false);
});
test("C11: snapshot apresenta cada Simple Bag como slot UUID distinto e não abre UUID alheio",()=>{
 const p=player(),n=merchant();p.gold=1000;
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 const packets:any[]=[];
 const sender=new InventorySender(ws);
 (sender as any).send=(payload:unknown)=>packets.push(payload);
 sender.sendInventory(p);
 const rows=packets[0].items.filter((i:any)=>i.itemId===simple);
 assert.equal(rows.length,2);
 assert.ok(rows.every((row:any)=>row.amount===1 && typeof row.instanceId==="string"));
 assert.equal(new Set(rows.map((row:any)=>row.instanceId)).size,2);
 assert.equal(parseClientMessage(JSON.stringify({
   type:"openBag",itemId:simple,instanceId:rows[0].instanceId
 })).ok,true);
 assert.equal(p.openNestedBag(simple,"outro-jogador-id"),false);
 assert.equal(p.isViewingNestedBag,false);
 assert.equal(p.openNestedBag(simple,rows[1].instanceId),true);
 assert.equal(p.isViewingNestedBag,true);
 assert.equal(p.closeNestedBag(),true);
 assert.equal(p.openNestedBag(simple,rows[0].instanceId),true);
 assert.equal(p.closeNestedBag(),true);
});
test("C11 Unity: snapshot preserva UUID no slot e dupla seleção abre Bag exata",()=>{
 const dto=unity("Networking/Messages/Incoming/IncomingMessages.cs");
 const handler=unity("Networking/Handlers/InventoryHandler.cs");
 const slot=unity("Player/InventorySlot.cs");
 const inventory=unity("UI/InventoryUI.cs");
 assert.match(dto,/public string instanceId/);
 assert.match(handler,/rows\.Add\(new InventoryUI\.InventoryEntry/);
 assert.match(inventory,/slot\.Setup\(row\.itemId,row\.amount/);
 assert.match(inventory,/net\.Inventory\?\.OpenBag\(itemId,instanceId\)/);
 assert.match(slot,/OnBagOpen\?\.Invoke\(itemId, bagInstanceId\)/);
});
test("C11: drop por UUID escolhe Bag correta e UUID falso nunca remove item",async()=>{
 const s=scene(),p=player(),n=merchant();p.gold=1000;
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 assert.equal(ShopSystem.buyItem(p,n,simple,1),true);
 const rootId=p.equippedBagInstanceId;
 const child=p.getVisibleBagChildren();
 assert.equal(child.length,2);
 const a=child[0].instanceId,b=child[1].instanceId;
 assert.equal(p.openNestedBag(simple,a),true);
 assert.equal(p.addItem(potion,7),true);
 assert.equal(p.closeNestedBag(),true);
 await handleDropItem(ws,p,{
    type:"dropItem",itemId:simple,amount:1,x:2,y:3,fromEquipment:false,
    instanceId:"falso-uuid",
 },s.ctx);
 assert.equal(s.world.itemsOnGround.length,0);
 assert.equal(p.inventory.get(simple),2);
 assert.equal(p.getVisibleBagChildren().length,2);
 await handleDropItem(ws,p,{
    type:"dropItem",itemId:simple,amount:1,x:2,y:3,fromEquipment:false,
    instanceId:b,
 },s.ctx);
 assert.equal(s.world.itemsOnGround.length,1);
 assert.equal(s.world.itemsOnGround[0].bagState?.equippedId,b);
 assert.equal(s.world.itemsOnGround[0].bagState?.bags[0].items[potion],undefined);
 assert.equal(p.inventory.get(simple),1);
 assert.equal(p.getVisibleBagChildren()[0].instanceId,a);
 assert.equal(p.equippedBagInstanceId,rootId);
 assert.equal(p.equipItem(simple,a),true);
 assert.equal(p.equippedBagInstanceId,a);
 assert.equal(p.inventory.get(potion),7,"equipa UUID selecionado, não outra Bag igual");
});
test("C11 UI: NPC não dispara shop fora de alcance; shopError não é exceção",()=>{
 const click=unity("NPC/ClickInteract.cs");
 const err=unity("Networking/Handlers/ShopErrorHandler.cs");
 const target=unity("Combat/TargetSelector.cs");
 assert.match(click,/TryGetConfirmedGridPosition\(out Vector2Int position\)/);
 assert.match(click,/distance > 2/);
 assert.match(click,/Aproxime-se do NPC/);
 assert.match(err,/Debug\.LogWarning\(/);
 assert.doesNotMatch(err,/Debug\.LogError\(/);
 assert.match(target,/ClickKind\(best\) == WorldClickKind\.GroundItem/);
});
test("C11 UI: ao sair a 3 tiles loot fecha e Shift+L não conflita com E",()=>{
 const loot=unity("UI/LootUI.cs");
 const dock=unity("UI/C8SidebarDynamicDock.cs");
 assert.match(loot,/LootReachTiles = 2/);
 assert.match(loot,/TryGetConfirmedGridPosition\(out Vector2Int pos\)/);
 assert.match(loot,/Mathf\.Abs\(pos\.x-x\)\+Mathf\.Abs\(pos\.y-y\) <= LootReachTiles/);
 assert.match(loot,/CloseAllLootWindows\(\)/);
 assert.match(loot,/k\.lKey\.wasPressedThisFrame/);
 assert.doesNotMatch(loot,/k\.eKey\.wasPressedThisFrame/);
 assert.doesNotMatch(dock,/NavigationButton\(takeAllObj,"TODOS"/);
 assert.match(unity("UI/InventoryUI.cs"),/network\.Inventory\.OpenBag\(itemId\)/);
 assert.match(unity("UI/InventoryUI.cs"),/k\.backspaceKey\.wasPressedThisFrame/);
 assert.match(unity("Networking/Senders/InventorySender.cs"),/public void CloseBag\(\)/);
});
test("C11 style: identidade visual original Obsidian & Bronze usa tema unificado",()=>{
 const theme=unity("UI/C11VisualTheme.cs");
 assert.match(theme,/public static class C11VisualTheme/);
 assert.match(theme,/public static readonly Color32 Surface/);
 assert.match(theme,/public static readonly Color32 Bronze/);
 assert.match(theme,/Frame\(GameObject go\)/);
 for (const p of ["UI/C8SidebarShell.cs","UI/C8SidebarDynamicDock.cs",
                   "UI/C10ClientLayoutSettings.cs","UI/WorldWindowLayout.cs"])
   assert.match(unity(p),/C11VisualTheme\./);
});
