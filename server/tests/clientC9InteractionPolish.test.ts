import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseClientMessage } from "../src/network/validation/messageValidation";
import { handlers } from "../src/network/handlers";

const unity = (p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
const server = (p:string)=>readFileSync(join(process.cwd(),"src",p),"utf8");

test("C9: fromEquipment existe em Unity Sender, DTO, Zod e Node — não é decidido por itemId",()=>{
 const drag=unity("Managers/DragDropManager.cs");
 const sender=unity("Networking/Senders/InventorySender.cs");
 const outgoing=unity("Networking/Messages/Outgoing/OutgoingMessages.cs");
 const handler=server("network/handlers/inventory.handler.ts");
 assert.match(drag,/SendDropItem\(draggedItemId, 1, tileX, tileY,/);
 assert.match(sender,/fromEquipment = fromEquipment/);
 assert.match(outgoing,/public bool fromEquipment/);
 assert.match(handler,/const fromEquipment = msg\.fromEquipment === true/);
 assert.match(handler,/player\.equipment\.delete\(equippedSlot!\)/);
 assert.match(handler,/player\.recalculateStats\(\)/);
 assert.doesNotMatch(handler,/if \(!alreadyInBag && equippedSlot !== undefined && !player\.unequipItem/);
 assert.equal(parseClientMessage(JSON.stringify({
   type:"dropItem",itemId:"equipment/backpack/basic_backpack",amount:1,
   x:2,y:2,fromEquipment:true
 })).ok,true);
 for (const fromEquipment of ["true",5,null]) {
   assert.equal(parseClientMessage(JSON.stringify({
     type:"dropItem",itemId:"foo",amount:1,x:2,y:2,fromEquipment,
   })).ok,false);
 }
});

test("C9: chão aceita apenas 1 contêiner válido sem Bag e responde equipment",()=>{
 const src=server("network/handlers/inventory.handler.ts");
 assert.match(src,/item\.slot === EquipmentSlot\.BACKPACK/);
 assert.match(src,/onGround\.amount === 1/);
 assert.match(src,/player\.attachGroundBag\(onGround\.itemId, onGround\.bagState, true\)/);
 assert.match(src,/if \(bootstrap\) ctx\.packetSender\.inventory\.sendEquipment\(player\)/);
 assert.match(src,/ctx\.world\.removeItemOnGround\(onGround\)/);
 assert.match(src,/ctx\.broadcast\.broadcastDespawn\(onGround\.id\)/);
 assert.match(src,/sendPickupError\(why\)/);
});

test("C9: labels não interceptam UI e NPC ganha prioridade sobre item ao chão somente",()=>{
 const name=unity("Managers/ItemNameManager.cs");
 const target=unity("Combat/TargetSelector.cs");
 assert.match(name,/newText\.raycastTarget = false/);
 assert.match(name,/GetComponentsInChildren<UnityEngine\.UI\.Graphic>\(true\)/);
 assert.match(target,/Collider2D bestNpc = null/);
 assert.match(target,/kind == WorldClickKind\.Npc/);
 assert.match(target,/ClickKind\(best\) == WorldClickKind\.GroundItem/);
 assert.match(target,/if \(currentTargetId == clickedId\)/);
 assert.match(target,/network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
 assert.match(target,/npcInteract\.Interact\(\)/);
 assert.match(target,/CompleteGroundPickupOnRelease\(\)/);
 assert.match(target,/Mouse\.current\.leftButton\.wasReleasedThisFrame/);
 assert.match(target,/slot\.slotType == EquipmentSlot\.BACKPACK/);
 assert.match(target,/network\.Inventory\.SendPickupItem\(id\)/);
 assert.match(target,/if \(IsPointerOverUi\(\)\) return/);
});

test("C9: cadáver->chão é comando próprio, com scope, distância, bounds, índice e ACK",()=>{
 const l=server("network/handlers/loot.handler.ts");
 const dto=server("network/messages/client/inventory.messages.ts");
 const gui=unity("UI/LootUI.cs");
 const ui=unity("UI/LootItemSlot.cs");
 const sender=unity("Networking/Senders/InventorySender.cs");
 assert.match(l,/handleDropCorpseLoot\(/);
 assert.match(l,/canDropOnWorldTile\(ctx\.world, player, x, y\)/);
 assert.match(l,/corpseDistance > 2/);
 assert.match(l,/corpse\.loot\.splice\(msg\.itemIndex, 1\)/);
 assert.match(l,/ctx\.broadcast\.broadcastSpawnItemOnGround\(ground\)/);
 assert.match(l,/ctx\.packetSender\.loot\.sendLootTaken\(corpse\.id, msg\.itemIndex\)/);
 assert.match(dto,/ClientDropCorpseLootMessage/);
 assert.match(gui,/SendDropCorpseLoot\(currentCorpseId, index, x, y\)/);
 assert.match(ui,/DropItemToWorld\(index, eventData\.position\)/);
 assert.match(sender,/public void SendDropCorpseLoot\(/);
 assert.equal(typeof handlers.dropCorpseLoot,"function");
 assert.equal(parseClientMessage(JSON.stringify({
   type:"dropCorpseLoot",corpseId:"c1",itemIndex:2,x:3,y:2
 })).ok,true);
 for(const invalid of [
   {type:"dropCorpseLoot",corpseId:"c1",itemIndex:-1,x:2,y:2},
   {type:"dropCorpseLoot",corpseId:"c1",itemIndex:1.5,x:2,y:2},
   {type:"dropCorpseLoot",corpseId:"c1",itemIndex:0,x:"2",y:2},
   {type:"dropCorpseLoot",corpseId:"c1",itemIndex:0,x:2,y:2,playerId:"victim"},
 ]) assert.equal(parseClientMessage(JSON.stringify(invalid)).ok,false);
});

test("C9: Bag e loot têm limites de altura, scroll lento, linhas pequenas e LRU de cadáveres",()=>{
 const dock=unity("UI/C8SidebarDynamicDock.cs");
 const inv=unity("Player/InventorySlot.cs");
 const loot=unity("UI/LootUI.cs");
 assert.match(dock,/grid\.cellSize = new Vector2\(width, 62f\)/);
 assert.match(dock,/grid\.spacing = new Vector2\(4f, 3f\)/);
 assert.match(dock,/bagScroll\.scrollSensitivity = 5f/);
 assert.match(dock,/bagScroll\.inertia = false/);
 assert.match(dock,/Mathf\.Min\(112f,/);
 assert.match(dock,/Mathf\.Min\(128f,/);
 assert.match(dock,/freeHeight < 210f/);
 assert.match(loot,/PrepareRow\(slot, 36f, i % 2 == 1\)/);
 assert.match(loot,/scroll\.scrollSensitivity = 10f/);
 assert.match(loot,/private const int MaxTrackedCorpses = 4/);
 assert.match(loot,/openedCorpses\.RemoveAt\(0\)/);
 assert.match(loot,/net\.Inventory\.SendLoot\(openedCorpses\[next\]\)/);
 assert.match(inv,/rect\.sizeDelta = new Vector2\(34, 34\)/);
 assert.match(loot,/SendTakeLoot\(currentCorpseId, false, index\)/);
});
