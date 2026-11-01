/**
 * UI etapa 1/4 — contratos de isolamento da sidebar C8.
 * IMPORTANTE: testes estáticos Node/TS NÃO compilam, renderizam ou simulam Unity.
 * A aprovação depende de Play Mode, Game View e build Windows pelo usuário.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unity = (path: string) => readFileSync(join(process.cwd(), "..",
  "Client", "Assets", "Resources", "Scripts", path), "utf8");

test("UI 1/4: sidebar é uma camada visual independente, sem raycaster fullscreen", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  assert.match(ui, /class C8SidebarShell : MonoBehaviour/);
  assert.match(ui, /\[DisallowMultipleComponent\]/);
  assert.match(ui, /if \(canvasRoot != null\) return/);
  assert.match(ui, /new GameObject\("C8SidebarCanvas", typeof\(RectTransform\),\s*typeof\(Canvas\), typeof\(CanvasScaler\), typeof\(GraphicRaycaster\)\)/);
  assert.match(ui, /canvas\.renderMode = RenderMode\.ScreenSpaceOverlay/);
  assert.match(ui, /canvas\.sortingOrder = -5/);
  assert.match(ui, /scaler\.uiScaleMode = CanvasScaler\.ScaleMode\.ScaleWithScreenSize/);
  assert.match(ui, /scaler\.referenceResolution = new Vector2\(1920, 1080\)/);
  assert.match(ui, /rect\.anchorMin = new Vector2\(1f, 0f\)/);
  assert.match(ui, /rect\.anchorMax = new Vector2\(1f, 1f\)/);
  assert.match(ui, /rect\.sizeDelta = new Vector2\(SidebarWidth, -24f\)/);
  assert.match(ui, /GetComponent<C7UiAccessibility>\(\)\?\.ApplyCurrent\(\)/);
  assert.match(ui, /if \(canvasRoot != null\) Destroy\(canvasRoot\)/);
});

test("UI 1/4: nunca reintroduzir bloqueio de mouse por Image transparente", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  const selector = unity("Combat/TargetSelector.cs");
  assert.equal((ui.match(/\.raycastTarget = true/g) || []).length, 1,
    "Só a superfície opaca da sidebar deve ter raycast.");
  assert.match(ui, /image\.color = Background;\s*image\.raycastTarget = true/);
  assert.ok((ui.match(/\.raycastTarget = false/g) || []).length >= 4,
    "Labels, cards e acentos são meramente decorativos.");
  const root = ui.slice(ui.indexOf("canvasRoot = new GameObject("),
    ui.indexOf('var surface = new GameObject("SidebarSurface"'));
  assert.doesNotMatch(root, /AddComponent<Image>|typeof\(Image\)/,
    "Canvas fullscreen NÃO pode ter Graphic bloqueador.");
  assert.match(selector, /graphic\.color\.a <= 0\.001f/);
  assert.match(selector, /graphic\.canvasRenderer\.GetAlpha\(\) <= 0\.001f/);
  assert.match(selector, /if \(currentTargetId == clickedId\)\s*ClearTarget\(\)/,
    "O 2º clique no mesmo monstro DEVE parar o auto attack.");
  assert.match(selector, /network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
  assert.match(selector, /Physics2D\.GetRayIntersectionAll\(ray\)/);
});

test("UI 1/4: shell não encaixa painéis, não modifica câmera nem gameplay", () => {
  const ui = unity("UI/C8SidebarShell.cs");
  for (const forbidden of [
    /transform\.SetParent\([^)]*Panel/,
    /InventoryUI\.Instance|LootUI\.Instance|EquipmentUI\.Instance/,
    /WorldWindowLayout\.MakeDraggable|\.Bind\(/,
    /camera\.rect|Camera\.main|orthographicSize|CameraFollow/,
    /ScreenPointToRay|Physics2D|GetRayIntersection/,
    /SendAttack|SendLoot|SendMoveDir|SendStartAutoAttack/,
    /NetworkManager\.Instance\?\.Combat|NetworkManager\.Instance\?\.Inventory/,
    /IsPointerOverUi\(/,
    /Canvas\.ForceUpdateCanvases\(/,
  ]) assert.doesNotMatch(ui, forbidden,
    "Esta etapa é APENAS um invólucro visual, sem mexer em outros sistemas.");
  assert.match(ui, /bool visible = network != null && network\.isConnected/);
  assert.match(ui, /if \(canvasRoot\.activeSelf != visible\)/);
});

test("UI 1/4: NetworkManager cria uma sidebar por sessão sem tocar a cena YAML", () => {
  const net = unity("Networking/NetworkManager.cs");
  assert.match(net, /GetComponent<C8SidebarShell>\(\) == null\) gameObject\.AddComponent<C8SidebarShell>\(\)/);
  assert.ok(net.indexOf("AddComponent<C8SidebarShell>()") >
    net.indexOf("AddComponent<C7UiAccessibility>()"),
    "F10 deve existir antes da sidebar dinâmica.");
  assert.ok(net.indexOf("AddComponent<C8SidebarShell>()") <
    net.indexOf("if (requireAuthenticatedSession && !HasCredentials)"),
    "A casca deve existir em modo login, mas permanecer escondida sem conexão.");
  const meta = readFileSync(join(process.cwd(), "..", "Client",
    "Assets", "Resources", "Scripts", "UI", "C8SidebarShell.cs.meta"), "utf8");
  assert.match(meta, /guid: [0-9a-f]{32}/);
  const scene = readFileSync(join(process.cwd(), "..", "Client",
    "Assets", "scenebasic.unity"), "utf8");
  assert.doesNotMatch(scene, /m_Name: C8SidebarCanvas/,
    "Não serializar Canvas temporário na cena original.");
});
