/**
 * C16 — contratos estáticos do cliente Unity. Não substituem Play Mode.
 * Regressões que causavam só 2 slots/roda pulando e painel sem resize.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const source=(path:string)=>readFileSync(
  join(process.cwd(),"..","Client","Assets","Resources","Scripts",path),"utf8");

test("C16: Backpack usa 2 colunas, 2 linhas e mostra slots vazios até capacity Node",()=>{
 const dock=source("UI/C8SidebarDynamicDock.cs");
 const inventory=source("UI/InventoryUI.cs");
 assert.match(dock,/grid\.constraintCount = 2/);
 assert.match(dock,/grid\.cellSize = new Vector2\(width, 50f\)/);
 assert.match(dock,/MinBagHeight = 170f/);
 assert.match(inventory,/int available = Mathf\.Max\(0, bagSlots - slotsUsed\)/);
 assert.match(inventory,/CreateEmptySlotVisuals\(\)/);
 assert.match(inventory,/new GameObject\("C16EmptyBagSlot"/);
 assert.match(inventory,/image\.raycastTarget = false/);
 assert.match(dock,/viewport\.offsetMin = new Vector2\(5f, 46f\)/);
});
test("C16: correção de viewport não reduz o ScrollRect e preserva máscara e barras",()=>{
 const dock=source("UI/C8SidebarDynamicDock.cs");
 assert.match(dock,/if \(view == null \|\| view == scrollRoot\)/);
 assert.match(dock,/new GameObject\("C16ClippedViewport"/);
 assert.match(dock,/scroll\.content\.SetParent\(view, false\)/);
 assert.match(dock,/scroll\.viewport = view/);
 assert.match(dock,/view\.offsetMax = new Vector2\(-14f, 0f\)/);
 assert.match(dock,/scroll\.verticalScrollbar = root\.GetComponent<Scrollbar>\(\)/);
 assert.match(dock,/bar\.handleRect = hr/);
 assert.match(dock,/EnsureVerticalScrollbar\(bagScroll/);
 assert.match(dock,/EnsureVerticalScrollbar\(scroll/);
});
test("C16: roda do mouse limitada a 18px por evento, inclusive sobre scrollbar",()=>{
 const wheel=source("UI/C16FineScrollWheel.cs");
 const dock=source("UI/C8SidebarDynamicDock.cs");
 assert.match(wheel,/IScrollHandler/);
 assert.match(wheel,/Mathf\.Clamp\(eventData\.scrollDelta\.y, -1f, 1f\)/);
 assert.match(wheel,/steps \* 18f/);
 assert.match(wheel,/eventData\.Use\(\)/);
 assert.match(wheel,/scroll\.StopMovement\(\)/);
 assert.match(dock,/handler\.Bind\(scroll\)/);
 assert.match(dock,/wheel\.Bind\(scroll\)/);
});
test("C16: alça inferior é interativa e ajusta altura conforme host/slots e conteúdo",()=>{
 const dock=source("UI/C8SidebarDynamicDock.cs");
 const resize=source("UI/C16PanelResizeHandle.cs");
 assert.match(resize,/IBeginDragHandler, IDragHandler, IEndDragHandler/);
 assert.match(resize,/RectTransformUtility\.ScreenPointToLocalPointInRectangle/);
 assert.match(resize,/startHeight \+ startY - point\.y/);
 assert.match(dock,/CreateResizeHandle\(inventoryBackup\.rect, true\)/);
 assert.match(dock,/CreateResizeHandle\(lootBackup\.rect, false\)/);
 assert.match(dock,/PlayerPrefs\.GetFloat\(BagHeightKey, MinBagHeight\)/);
 assert.match(dock,/PlayerPrefs\.SetFloat\(bag \? BagHeightKey : LootHeightKey/);
 assert.match(dock,/Mathf\.CeilToInt\(slots \/ 2f\)/);
 assert.match(dock,/Mathf\.Min\(BagContentHeight\(\)/);
 assert.match(dock,/Mathf\.Min\(LootContentHeight\(\)/);
 assert.match(dock,/MinBagHeight \+ MinLootHeight \+ PanelGap/);
 assert.match(dock,/lootTop = sameHost && showBag && showLoot/);
});
test("C16: atualizar um loot não manda o scroll de volta ao topo",()=>{
 const loot=source("UI/LootUI.cs");
 assert.match(loot,/resetScrollOnRebuild = currentCorpseId != corpseId/);
 assert.match(loot,/if \(resetScrollOnRebuild\) scroll\.verticalNormalizedPosition = 1f/);
 assert.match(loot,/resetScrollOnRebuild = false/);
 assert.match(loot,/visibleItems\.RemoveAt\(itemIndex\.Value\)/);
});
test("C16: somente UI local, sem mudar economia, protocolo ou alcance de loot",()=>{
 const dock=source("UI/C8SidebarDynamicDock.cs");
 const resize=source("UI/C16PanelResizeHandle.cs");
 const wheel=source("UI/C16FineScrollWheel.cs");
 for(const code of [resize,wheel]) {
   assert.doesNotMatch(code,/SendTakeLoot|TransferBagItem|SendDropItem|fetch\(|DB_|world\.add|ClientMessage/);
 }
 assert.doesNotMatch(dock,/SendTakeLoot\(|SendDropItem\(|SendEquipItem\(/);
});