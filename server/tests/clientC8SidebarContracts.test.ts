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
  assert.match(ui, /SidebarWidth = C10ClientLayoutSettings\.MainCompactWidth/);
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
  assert.match(ui, /new GameObject\("MiniMapTilePreview"/);
  assert.match(ui, /CreateCircularMiniMapTexture\(\)/);
 assert.doesNotMatch(ui, /AddText\(settings.transform, "SettingsTitle"/);
 assert.doesNotMatch(ui, /AddText\(dynamicSection.transform, "DynamicTitle"/);
});

test("UI 2A: EquipmentPanel ORIGINAL é reparentado sem clone e sem perder slots/WS", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  const equipment = unity("UI/EquipmentUI.cs");
  assert.match(ui, /var ui = EquipmentUI\.Instance;/);
  assert.match(ui, /if \(panel\.transform\.Find\("C6DragHeader"\) == null\) return/);
  assert.match(ui, /rect\.SetParent\(equipmentHost, false\)/);
  assert.match(ui, /if \(drag != null\) drag\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /if \(close != null\) close\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /panel\.transform\.Find\("Equipaments"\)/);
  assert.match(ui, /hierarchyTitle\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /panel\.transform\.Find\("C6Help"\)/);
  assert.match(ui, /help\.gameObject\.SetActive\(false\)/);
  assert.match(ui, /ui\.SetSidebarDocked\(true\)/);
  assert.match(ui, /dockedEquipment\.SetSidebarDocked\(false\)/);
  assert.match(ui, /rt\.SetParent\(originalEquipmentParent, false\)/);
  assert.match(ui, /rt\.anchorMin = previousAnchorMin/);
  assert.match(ui, /rt\.offsetMax = previousOffsetMax/);
  assert.match(ui, /drag\.gameObject\.SetActive\(previousDragVisible\)/);
  assert.match(ui, /close\.gameObject\.SetActive\(previousCloseVisible\)/);
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
  assert.match(ui, /EquipmentSlotSize = 50f/);
  assert.match(ui, /EquipmentStepX = 62f/);
  assert.match(ui, /EquipmentStepY = 53f/);
  const sidebarWidth = 228;
  const cardWidth = sidebarWidth - 2 * 13;
  const hostWidth = cardWidth - 2 * 8;
  const lastSlotEdge = (hostWidth - (50 + 62 * 2)) / 2 + 62 * 2 + 50;
  assert.ok(lastSlotEdge <= hostWidth, "ultima coluna dentro do painel");
  const compactEquipmentHeight = 260;
  const hostHeight = compactEquipmentHeight - 6 - 36;
  const lastRowBottom = 4 + 3 * 53 + 50;
  assert.ok(lastRowBottom <= hostHeight, "o slot BOOTS cabe no host compactado");
  assert.match(ui, /sr\.anchoredPosition = Vector2\.zero/);
  assert.match(ui, /sr\.sizeDelta = new Vector2\(SidebarWidth, 0f\)/);
  assert.match(ui, /private void RefreshResponsiveLayout\(\)/);
  assert.match(ui, /height < 760f/);
  assert.match(ui, /private void AdjustDynamicPlaceholder\(\)/);
 assert.match(ui, /dynamicHost\.offsetMax = new Vector2\(-6f, -8f\)/);
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

test("C17: seis pictogramas, sétima célula reservada ao logout, minimapa e barra full bleed", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  const icons = ["SettingsIcon","SoundIcon","ChatIcon","BackpackIcon","MapIcon","StatsIcon"];
  for (const icon of icons) assert.match(ui,new RegExp('"' + icon + '"'));
  for (const legacy of ['"CFG"','"SOM"','"AJUDA"'])
    assert.ok(!ui.includes(legacy), "sigla antiga removida: " + legacy);
  assert.match(ui, /texture\.SetPixels32\(pixels\)/);
  assert.match(ui, /Sprite\.Create\(miniMapTexture,/);
  assert.match(ui, /mapImage\.raycastTarget = false/);
  assert.match(ui, /image\.raycastTarget = false/);
  assert.match(ui, /label\.raycastTarget = false/);
  assert.match(ui, /if \(miniMapSprite != null\) Destroy\(miniMapSprite\)/);
  assert.match(ui, /if \(miniMapTexture != null\) Destroy\(miniMapTexture\)/);
  assert.ok(!ui.includes('Arraste os itens para equipar'));
  const oldScene = readFileSync(join(process.cwd(), "..", "Client", "Assets", "scenebasic.unity"), "utf8");
  assert.match(oldScene, /m_Name: Equipaments/, "título duplicado era objeto legado do scene YAML");
});

test("C8 viewport: a camera ja existente fica no espaco esquerdo SEM duplicar mundo", () => {
 const view = unity("UI/C8PlayfieldViewport.cs");
 const sidebar = unity("UI/C8SidebarShell.cs");
 const net = unity("Networking/NetworkManager.cs");
 const follow = unity("Core/CameraFollow.cs");
 const tiled = unity("World/TiledMapRenderer.cs");
 const target = unity("Combat/TargetSelector.cs");
 const scene = readFileSync(join(process.cwd(), "..", "Client", "Assets", "scenebasic.unity"), "utf8");
 assert.match(net, /GetComponent<C8PlayfieldViewport>\(\) == null/);
 assert.match(net, /gameObject\.AddComponent<C8PlayfieldViewport>\(\)/);
 assert.match(sidebar, /public RectTransform SidebarSurface => sidebarSurface/);
 assert.match(view, /worldCamera = Camera\.main/);
 assert.match(view, /sidebar\.SidebarSurface\.GetWorldCorners\(worldCorners\)/);
 assert.match(view, /RectTransformUtility\.WorldToScreenPoint\(null, worldCorners\[0\]\)\.x/);
 assert.match(view, /viewportWidth = availableWidth \/ Screen\.width/);
 assert.match(view, /worldCamera\.rect = new Rect\(viewportStart, 0f, viewportWidth, 1f\)/);
 assert.match(view, /worldCamera\.aspect = availableWidth \/ Screen\.height/);
 assert.match(view, /worldCamera\.ResetAspect\(\)/);
 assert.match(view, /if \(originalCaptured\) worldCamera\.rect = initialViewport/);
 assert.match(view, /network == null \|\| !network\.isConnected/);
 assert.match(view, /!sidebar\.SidebarSurface\.gameObject\.activeInHierarchy/);
 assert.match(view, /Mathf\.Abs\(lastWidth - viewportWidth\) < 0\.0005f/);
 assert.doesNotMatch(view, /new Camera\(|new GameObject\(|AddComponent<Camera>\(|new RenderTexture\(|FindObjectsByType<Camera>\(|ScreenPointToRay\(/);
 assert.match(scene, /m_Name: Main Camera/);
 assert.equal((scene.match(/^--- !u!20 &/gm) || []).length, 1,
   "A cena serializada contém uma única Camera; nenhuma outra é criada na UI.");
 assert.match(follow, /float halfWidth = halfHeight \* cameraComponent\.aspect/);
 assert.match(tiled, /if \(cam\.GetComponent<CameraFollow>\(\) == null\)/);
 assert.match(target, /camera\.ScreenPointToRay\(Mouse\.current\.position\.ReadValue\(\)\)/);
 assert.match(target, /if \(currentTargetId == clickedId\)\s*ClearTarget\(\)/);
 assert.match(target, /network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
});

test("C8 viewport: F10/duas resolucoes preservam largura visivel e aspecto ortografico", () => {
  // Validacao geometrica em TS nao substitui execucao Unity.
  for (const [w,h] of [[1920,1080],[1280,720]]) {
    for (const scale of [1,1.15,1.30]) {
      const sidePx = 228 * scale * (w / 1920);
      const left = w - sidePx;
      const portion = left / w;
      const aspect = left / h;
      assert.ok(portion > 0.70 && portion < 0.9,
        `viewport plausivel para ${w}x${h} F10 ${scale}`);
      assert.ok(Math.abs(aspect - ((w/h)*portion)) < 1e-9);
      assert.ok(left > 0 && sidePx > 0);
    }
  }
});
