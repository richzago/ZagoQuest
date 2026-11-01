import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const sourceFile=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
const serverFile=(p:string)=>readFileSync(join(process.cwd(),"src",p),"utf8");

test("C9: slots são configuráveis por item JSON, nunca constantes na rotina do Player",()=>{
 const s=serverFile("game/entities/player.ts");
 const t=serverFile("shared/interfaces/item.interface.ts");
 assert.match(t,/containerSlots\?: number/);
 assert.match(s,/getContainerCapacity\(\)/);
 assert.match(s,/ItemRegistry\.get\(bagId\)/);
 assert.match(s,/bag\.containerSlots/);
 assert.match(s,/getContainerSlotsUsed\(\)/);
 assert.match(s,/canCollectItems\(/);
 assert.doesNotMatch(s,/containerSlots\s*===?\s*10|containerSlots\s*===?\s*20/);
});

test("C9: sem atalho I; apenas Bag equipada desbloqueia abertura do painel",()=>{
 const s=sourceFile("UI/InventoryUI.cs");
 const slot=sourceFile("UI/EquipmentSlotUI.cs");
 const dto=sourceFile("Networking/Messages/Incoming/IncomingMessages.cs");
 const handler=sourceFile("Networking/Handlers/InventoryHandler.cs");
 assert.doesNotMatch(s,/InputAction|<Keyboard>\/i|OnToggleInventory/);
 assert.match(s,/HasEquippedBag/);
 assert.match(s,/ToggleBackpack\(\)/);
 assert.match(s,/bagSlots/);
 assert.match(s,/Slots: \{slotsUsed\}\/\{bagSlots\}/);
 assert.match(slot,/slotType == EquipmentSlot\.BACKPACK/);
 assert.match(dto,/public int bagSlots; public int slotsUsed;/);
 assert.match(handler,/invMsg\.bagItemId, invMsg\.bagSlots, invMsg\.slotsUsed/);
});

test("C9: take-all por Ctrl+Shift+L e drag enviado como takeLoot individual",()=>{
 const loot=sourceFile("UI/LootUI.cs");
 const row=sourceFile("UI/LootItemSlot.cs");
 const drop=sourceFile("UI/C9LootBagDropTarget.cs");
 const inventorySlot=sourceFile("Player/InventorySlot.cs");
 assert.match(loot,/k\.lKey\.wasPressedThisFrame/);
 assert.match(loot,/k\.leftCtrlKey\.isPressed \|\| k\.rightCtrlKey\.isPressed/);
 assert.match(loot,/k\.leftShiftKey\.isPressed \|\| k\.rightShiftKey\.isPressed/);
 assert.match(loot,/takeAllButton\.gameObject\.SetActive\(false\)/);
 assert.match(loot,/SendTakeLoot\(currentCorpseId, true\)/);
 assert.match(loot,/SendTakeLoot\(currentCorpseId, false, index\)/);
 assert.match(loot,/public void TakeByDrop\(int index\)/);
 assert.match(row,/IBeginDragHandler, IDragHandler, IEndDragHandler/);
 assert.match(drop,/LootUI\.Instance\?\.TakeByDrop\(row\.ItemIndex\)/);
 assert.match(inventorySlot,/LootUI\.Instance\?\.TakeByDrop\(lootRow\.ItemIndex\)/);
});

test("C9: Bag e loot compartilham área responsiva, logout na zona de acesso rápido",()=>{
 const dock=sourceFile("UI/C8SidebarDynamicDock.cs");
 const shell=sourceFile("UI/C8SidebarShell.cs");
 const login=sourceFile("Networking/SessionLoginDebugUI.cs");
 assert.match(dock,/inventory\.HasEquippedBag/);
 assert.match(dock,/showBag \? Mathf\.Min\(168f,/);
 assert.match(dock,/lootBackup\.rect/);
 assert.match(dock,/loot\.OpenedLootCount > 1/);
 assert.match(shell,/public RectTransform QuickAccessHost => quickAccessHost/);
 assert.match(login,/TryDockLogout\(network != null && network\.isConnected\)/);
 assert.match(login,/logoutButtonRect\.SetParent\(host, false\)/);
 assert.match(login,/btn\.onClick\.AddListener\(Logout\)/);
 assert.doesNotMatch(dock,/IsPointerOverUi|Camera\.rect|CameraFollow/);
});
