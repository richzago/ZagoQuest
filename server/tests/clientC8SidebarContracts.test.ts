/**
 * C8 UI etapa 2A: contratos ESTÁTICOS de estrutura e segurança.
 * Estes testes não compilam C# nem executam o EventSystem/Unity Play Mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unity = (path: string) => readFileSync(join(process.cwd(), "..",
  "Client", "Assets", "Resources", "Scripts", path), "utf8");

test("UI 2A: quatro áreas ordenadas, com minimapa e configuracoes ainda futuros", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  assert.match(ui, /class C8SidebarShell : MonoBehaviour/);
  assert.match(ui, /new GameObject\("C8SidebarCanvas", typeof\(RectTransform\)/);
  assert.match(ui, /new GameObject\("SidebarSurface", typeof\(RectTransform\), typeof\(Image\)\)/);
  assert.match(ui, /canvas\.sortingOrder = 110/);
  assert.match(ui, /SidebarWidth = 304f/);
  assert.match(ui, /scaler\.uiScaleMode = CanvasScaler\.ScaleMode\.ScaleWithScreenSize/);
  assert.match(ui, /GetComponent<C7UiAccessibility>\(\)\?\.ApplyCurrent\(\)/);
  const ordered = ["MiniMapSection", "EquipmentSection",
    "SettingsIconsSection", "DynamicContentSection"];
  let last = -1;
  for (const marker of ordered) {
    const at = ui.indexOf('"' + marker + '"');
    assert.ok(at > last, `A secao ${marker} deve vir apos a anterior`);
    last = at;
  }
  assert.match(ui, /public RectTransform DynamicHost => dynamicHost/);
  assert.match(ui, /SidebarDynamicHost/);
  assert.match(ui, /MAPA EM DESENVOLVIMENTO/);
  assert.match(ui, /ACESSO RAPIDO/);
  assert.match(ui, /MOCHILAS  \/  LOOT/);
});

test("UI 2A: EquipmentPanel ORIGINAL é reparentado sem clone e sem perder slots/WS", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  const equipment = unity("UI/EquipmentUI.cs");
  assert.match(ui, /var ui = EquipmentUI\.Instance;/);
  assert.match(ui, /if \(panel\.transform\.Find\("C6DragHeader"\) == null\) return/);
  assert.match(ui, /rect\.SetParent\(equipmentHost, false\)/);
  assert.match(ui, /if \(drag != null\) drag\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /if \(close != null\) close\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /ui\.SetSidebarDocked\(true\)/);
  assert.match(ui, /dockedEquipment\.SetSidebarDocked\(false\)/);
  assert.match(ui, /panel\.transform\.SetParent\(originalEquipmentParent, false\)/);
  assert.match(ui, /switch \(slot\.slotType\)/);
  for (const slot of ["AMULET", "HELMET", "BACKPACK", "WEAPON",
    "ARMOR", "SHIELD", "RING", "LEGS", "USEFUL"])
    assert.match(ui, new RegExp("EquipmentSlot\\." + slot));
  assert.match(ui, /default: col = 1; row = 3; break; \/\/ BOOTS/);
  assert.match(equipment, /public bool IsDockedInSidebar/);
  assert.match(equipment, /if \(IsDockedInSidebar\) return/);
  assert.match(equipment, /UpdateEquipment\(Dictionary<EquipmentSlot, string> equipment\)/);
  assert.match(equipment, /C6InventoryEquipmentLayout\.Equipment\(equipmentPanel, slotsContainer,/);
  assert.doesNotMatch(ui, /new GameObject\("EquipmentPanel"|Instantiate\(.*Equipment/);
});

test("UI 2A: C7 cliques e UI Canvas nao sofrem regressao de Raycast", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  const target = unity("Combat/TargetSelector.cs");
  const root = ui.slice(ui.indexOf('canvasRoot = new GameObject("C8SidebarCanvas"'),
    ui.indexOf('var surface = new GameObject("SidebarSurface"'));
  assert.doesNotMatch(root, /typeof\(Image\)|AddComponent<Image>/,
    "Canvas fullscreen nunca pode conter Graphic");
  assert.match(ui, /background\.color = Background;\s*background\.raycastTarget = true/);
  assert.match(ui, /image\.raycastTarget = false/);
  assert.match(ui, /label\.raycastTarget = false/);
  assert.match(ui, /canvas\.sortingOrder = 110/,
    "Sidebar acima da HUD que tinha imagens transparentes, sem interceptar fora da barra");
  assert.match(target, /graphic\.color\.a <= 0\.001f/);
  assert.match(target, /graphic\.canvasRenderer\.GetAlpha\(\) <= 0\.001f/);
  assert.match(target, /if \(currentTargetId == clickedId\)\s*ClearTarget\(\)/);
  assert.match(target, /network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
  assert.match(target, /Physics2D\.GetRayIntersectionAll\(ray\)/);
  assert.doesNotMatch(ui, /IsPointerOverUi\(/,
    "Nova sidebar nao pode implementar um segundo filtro de cliques");
});

test("UI 2A: equipamentos cabem fisicamente na coluna, sem resize horizontal de painel", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  assert.match(ui, /EquipmentSlotSize = 56f/);
  assert.match(ui, /EquipmentStepX = 74f/);
  assert.match(ui, /EquipmentStepY = 67f/);
  const sidebarWidth = 304;
  const cardWidth = sidebarWidth - 2 * 13;
  const hostWidth = cardWidth - 2 * 8;
  const lastSlotEdge = (hostWidth - (56 + 74 * 2)) / 2 + 74 * 2 + 56;
  assert.ok(lastSlotEdge <= hostWidth, "ultima coluna dentro do painel");
  const equipmentSectionHeight = 369;
  const hostHeight = equipmentSectionHeight - 10 - 65;
  const lastRowBottom = 12 + 3 * 67 + 56;
  assert.ok(lastRowBottom < hostHeight, "o slot BOOTS cabe no host");
  assert.match(ui, /sr\.sizeDelta = new Vector2\(SidebarWidth, -24f\)/);
  assert.match(ui, /private void AdjustDynamicPlaceholder\(\)/);
  assert.match(ui, /dynamicHost\.offsetMax = new Vector2\(-10f, -header\)/);
});

test("UI 2A: continua exclusivo da UI: nada de camera, backend, loot automatico ou pesca", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  for (const forbidden of [
    /Camera\.main|CameraFollow|camera\.rect|orthographicSize/,
    /Physics2D|ScreenPointToRay|GetRayIntersection/,
    /SendAttack|SendLoot|SendMoveDir|SendStartAutoAttack|SendTakeLoot/,
    /FishingSystem|C7FishingUI\(\)|StartFishing\(/,
    /LootUI\.Instance|InventoryUI\.Instance|\.SendEquipItem\(/,
    /FindObjectsByType<Canvas>|Canvas\.ForceUpdateCanvases\(/,
  ]) assert.doesNotMatch(ui, forbidden);
  assert.match(ui, /bool connected = net != null && net\.isConnected/);
  assert.match(ui, /if \(canvasRoot\.activeSelf != connected\)/);
  const net = unity("Networking/NetworkManager.cs");
  assert.match(net, /GetComponent<C8SidebarShell>\(\) == null\) gameObject\.AddComponent<C8SidebarShell>\(\)/);
  const scene = readFileSync(join(process.cwd(), "..", "Client", "Assets", "scenebasic.unity"), "utf8");
  assert.doesNotMatch(scene, /m_Name: C8SidebarCanvas/);
});
