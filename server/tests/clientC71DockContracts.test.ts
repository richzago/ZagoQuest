/** C7.1: contratos estáticos dos componentes Unity, sem simular Editor/Hierarchy. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
const unity=(name:string)=>readFileSync(join(process.cwd(),"..","Client",
 "Assets","Resources","Scripts",name),"utf8");
test("C7.1: painel stack vertical sem overlap, largura fixa e scroll",()=>{
 const dock=unity("UI/C7DockLayout.cs");
 const resize=unity("UI/C7DockResizeGrip.cs");
 const drag=unity("UI/C6WindowDragHandle.cs");
 const network=unity("Networking/NetworkManager.cs");
 assert.match(network,/AddComponent<C7DockLayout>\(\)/);
 assert.match(dock,/new VerticalLayoutGroup|typeof\(VerticalLayoutGroup\)/);
 assert.match(dock,/group\.childControlHeight = true/);
 assert.match(dock,/scroll\.vertical = true/);
 assert.match(dock,/scroll\.horizontal = false/);
 assert.match(dock,/private const float SidebarWidth = 314f/);
 assert.match(dock,/typeof\(C7DockResizeGrip\)/);
 assert.match(dock,/registered\[panel\] = layout/);
 assert.match(dock,/layout\.preferredHeight = Mathf\.Clamp/);
 assert.match(dock,/PlayerPrefs\.SetFloat\(KeyPrefix/);
 assert.match(drag,/C7DockLayout\.IsDocked\(panel\)/);
 assert.match(drag,/C7DockLayout\.Reorder\(panel/);
 assert.match(drag,/C7DockLayout\.ResetHeight\(panel\)/);
 assert.match(resize,/C7DockLayout\.Resize\(panel/);
 assert.doesNotMatch(resize,/sizeDelta\.x|delta\.x|width\s*=/);
});
test("C7.1: câmera reserva viewport para dock e chat, sem ocultar o player",()=>{
 const dock=unity("UI/C7DockLayout.cs");
 const cam=unity("Core/CameraFollow.cs");
 assert.match(dock,/worldCamera\.rect = desired/);
 assert.match(dock,/new Rect\(0, y, width, 1f - y\)/);
 assert.match(dock,/float right = SidebarWidth \* scale/);
 assert.match(dock,/float bottom = ChatHeight \* scale/);
 assert.match(dock,/chat\.anchoredPosition = new Vector2\(8, 4\)/);
 assert.match(cam,/cameraComponent\.pixelWidth \/ \(float\)cameraComponent\.pixelHeight/);
});
test("C7.1: painéis menores, controles merchant em duas linhas, pesca entra no dock",()=>{
 const fish=unity("UI/C7FishingUI.cs");
 const shop=unity("NPC/ShopItemSlot.cs");
 const slots=unity("UI/C6InventoryEquipmentLayout.cs");
 const inv=unity("Player/InventorySlot.cs");
 assert.match(fish,/MakeDraggable\(panel, "PESCA", "fishing"\)/);
 assert.match(fish,/panelObject\.SetActive\(connected\)/);
 assert.match(shop,/0\.28f, 0\.06f, 0\.60f, 0\.35f/);
 assert.match(shop,/0\.64f, 0\.06f, 0\.96f, 0\.35f/);
 assert.match(slots,/grid\.cellSize = new Vector2\(82, 82\)/);
 assert.match(inv,/rect\.sizeDelta = new Vector2\(42, 42\)/);
});
