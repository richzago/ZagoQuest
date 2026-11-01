import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts");
const unity = (p: string) => readFileSync(join(root, p), "utf8");

test("C12 UI: arraste ignora overlays transparentes e valida viewport", () => {
  const manager = unity("Managers/DragDropManager.cs");
  assert.match(manager, /public static bool PointerBlocksWorldDrop\(PointerEventData pointer\)/);
  assert.match(manager, /EventSystem\.current\.RaycastAll\(query, hits\)/);
  assert.match(manager, /group\.alpha <= 0\.001f/);
  assert.match(manager, /graphic\.color\.a > 0\.001f/);
  assert.match(manager, /GetComponentInParent<Selectable>\(\)/);
  for (const file of ["Player/InventorySlot.cs", "UI/EquipmentSlotUI.cs"]) {
    const value = unity(file);
    assert.match(value, /DragDropManager\.PointerBlocksWorldDrop\(eventData\)/);
    assert.match(value, /Camera\.main\.pixelRect\.Contains\(eventData\.position\)/);
    assert.doesNotMatch(value, /target\.GetComponentInParent<Canvas>\(\)/);
  }
  assert.match(manager, /TryGetConfirmedGridPosition\(out Vector2Int playerTile\)/);
  assert.match(manager, /dx > 8 \|\| dy > 6/);
  assert.match(manager, /SendDropItem\(draggedItemId, 1, tileX, tileY,/);
});
test("C12 UI: botão Sair não usa glifo U+23FB ausente na fonte", () => {
  const login = unity("Networking/SessionLoginDebugUI.cs");
  assert.doesNotMatch(login, /\u23FB/);
  assert.match(login, /logoutButtonLabel\.text = "OFF"/);
  assert.match(login, /text\.text = "SAIR"/);
});
test("C12 UI: cabeçalho e minimapa quadrado de placeholder", () => {
  const shell = unity("UI/C8SidebarShell.cs");
  assert.match(shell, /ObsidianTitlePlate/);
  assert.match(shell, /MiniMapTilePreview/);
  assert.match(shell, /tileLine = x % 16 == 0/);
  assert.match(shell, /CLIENTE C12/);
  assert.match(unity("UI/C11VisualTheme.cs"), /public static readonly Color32 Bronze/);
});
