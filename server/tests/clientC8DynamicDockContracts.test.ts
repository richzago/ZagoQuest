/** UI C8/2B — contratos ESTÁTICOS do dock: CI não executa Unity C#. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unity = (p: string) => readFileSync(join(process.cwd(), "..",
 "Client", "Assets", "Resources", "Scripts", p), "utf8");

test("UI2B: inicializa DOIS painéis originais e não duplica instâncias/prefabs", () => {
 const dock = unity("UI/C8SidebarDynamicDock.cs");
 const net = unity("Networking/NetworkManager.cs");
 const scene = readFileSync(join(process.cwd(),"..","Client","Assets","scenebasic.unity"),"utf8");
 assert.match(net,/GetComponent<C8SidebarDynamicDock>\(\) == null/);
 assert.match(net,/gameObject\.AddComponent<C8SidebarDynamicDock>\(\)/);
 assert.match(dock,/var host = shell\.DynamicHost/);
 assert.match(dock,/inventory = InventoryUI\.Instance/);
 assert.match(dock,/loot = LootUI\.Instance/);
 assert.match(dock,/Capture\(inventory\.inventoryPanel\.transform as RectTransform\)/);
 assert.match(dock,/Capture\(loot\.transform as RectTransform\)/);
 assert.match(dock,/Dock\(inventoryBackup\.rect, host\)/);
 assert.match(dock,/Dock\(lootBackup\.rect, host\)/);
 assert.match(dock,/if \(inventory\.inventoryPanel\.transform\.Find\("C6InventoryViewport"\) == null/);
 assert.match(dock,/loot\.transform\.Find\("C6DragHeader"\) == null/);
 assert.match(dock,/host\.gameObject\.AddComponent<RectMask2D>\(\)/);
 assert.match(scene,/m_Name: InventoryPanel/);
 assert.match(scene,/m_Name: LootPanel/);
 assert.match(scene,/m_Name: PanelVisual/);
 assert.doesNotMatch(dock,/Instantiate\(|new LootUI|new InventoryUI|new EquipmentUI|AddComponent<Camera>/);
});

test("UI2B: abas e contenção de raycast isoladas da área de jogo",()=>{
 const dock=unity("UI/C8SidebarDynamicDock.cs");
 const sidebar=unity("UI/C8SidebarShell.cs");
 const target=unity("Combat/TargetSelector.cs");
 assert.match(dock,/ButtonAt\("BackpackTab", "BACKPACK"/);
 assert.match(dock,/ButtonAt\("LootTab", "LOOT"/);
 assert.match(dock,/ButtonAt\("CloseLoot", "×"/);
 assert.match(dock,/inventoryGroup\.blocksRaycasts = showBag/);
 assert.match(dock,/lootGroup\.blocksRaycasts = showLoot/);
 assert.match(dock,/image\.raycastTarget = true/);
 assert.match(dock,/label\.raycastTarget = false/);
 assert.match(dock,/panelImage\.raycastTarget = false/);
 assert.match(dock,/if \(image != null\) image\.raycastTarget = false/);
 assert.match(sidebar,/GetComponent<C8SidebarDynamicDock>\(\)\?\.Undock\(\)/);
 assert.match(sidebar,/public RectTransform DynamicHost => dynamicHost/);
 assert.match(sidebar,/shell/);
 assert.match(target,/if \(currentTargetId == clickedId\)\s*ClearTarget\(\)/);
 assert.match(target,/network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
 assert.doesNotMatch(dock,/IsPointerOverUi|ScreenPointToRay|Physics2D|Camera\.main|Canvas\.ForceUpdateCanvases/);
});

test("UI2B: loot preserva índices e bloqueia requisições repetidas ao Node",()=>{
 const loot=unity("UI/LootUI.cs"),slot=unity("UI/LootItemSlot.cs");
 const dock=unity("UI/C8SidebarDynamicDock.cs");
 assert.match(loot,/row\.Setup\(visibleItems\[i\], i, OnItemClicked\)/);
 assert.match(loot,/row\.CompactForSidebar\(\)/);
 assert.match(loot,/slot\.SetActive\(false\);\s*Destroy\(slot\)/);
 assert.match(loot,/if \(!ReadyToTake\(\) \|\| index < 0 \|\| index >= visibleItems\.Count\) return/);
 assert.match(loot,/NetworkManager\.Instance\.Inventory\.SendTakeLoot\(currentCorpseId, false, index\)/);
 assert.match(loot,/NetworkManager\.Instance\.Inventory\.SendTakeLoot\(currentCorpseId, true\)/);
 assert.match(loot,/if \(corpseId != currentCorpseId\) return/);
 assert.match(loot,/visibleItems\.RemoveAt\(itemIndex\.Value\)/);
 assert.match(loot,/C8SidebarDynamicDock\.Instance\?\.OnLootOpened\(\)/);
 assert.match(loot,/C8SidebarDynamicDock\.Instance\?\.OnLootClosed\(\)/);
 assert.match(slot,/onItemClick\?\.Invoke\(index\)/);
 assert.match(dock,/scroll\.horizontal = false/);
 assert.match(dock,/scroll\.vertical = true/);
 assert.match(dock,/loot\.CloseLootWindow\(\)/);
});

test("UI2B: mochila é inventário já existente, 2 colunas e scroll; nenhuma mochila persistente inventada",()=>{
 const dock=unity("UI/C8SidebarDynamicDock.cs");
 const inventory=unity("UI/InventoryUI.cs");
 const oldLayout=unity("UI/C6InventoryEquipmentLayout.cs");
 assert.match(dock,/grid\.constraintCount = 2/);
 assert.match(dock,/grid\.cellSize = new Vector2\(width, 62f\)/);
 assert.match(dock,/grid\.padding = new RectOffset\(4, 4, 4, 4\)/);
 assert.match(dock,/inventory\.OpenInventory\(\)/);
 assert.match(inventory,/public void OpenInventory\(\)/);
 assert.match(inventory,/public bool IsInventoryOpen => isInventoryOpen/);
 assert.match(inventory,/C8SidebarDynamicDock\.Instance\?\.OnInventoryVisibilityChanged/);
 assert.match(inventory,/slotScript\.Setup\(kvp\.Key, kvp\.Value,/);
 assert.match(oldLayout,/scroll\.vertical = true/);
 assert.match(dock,/Restore\(inventoryBackup\)/);
 assert.match(dock,/Restore\(lootBackup\)/);
 assert.doesNotMatch(dock,/SendTakeLoot\(|SendEquipItem\(|SendUnequipItem\(|UseItem\(|ChangeGold|Bank/);
});

test("UI2B: proporções da área dinâmica aceitam 1280x720 e F10 sem modificar viewport",()=>{
 const dock=unity("UI/C8SidebarDynamicDock.cs"),view=unity("UI/C8PlayfieldViewport.cs");
 assert.match(dock,/tabBar\.offsetMin = new Vector2\(8f, -84f\)/);
 assert.match(dock,/tabBar\.offsetMax = new Vector2\(-8f, -45f\)/);
 assert.match(dock,/scrollRect\.anchorMin = new Vector2\(0\.02f, 0\.04f\)/);
 assert.match(dock,/scrollRect\.anchorMax = new Vector2\(0\.98f, 0\.98f\)/);
 assert.match(dock,/closeLootButton\.gameObject\.SetActive/);
 assert.match(dock,/if \(lootButton != null\) lootButton\.interactable/);
 assert.match(view,/worldCamera\.rect = new Rect\(viewportStart, 0f, viewportWidth, 1f\)/);
 assert.doesNotMatch(dock,/worldCamera|Screen\.width|CameraFollow|GameManager\.Instance|Physics2D/);
});
