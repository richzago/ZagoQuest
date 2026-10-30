import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

// Static C# / Unity scene checks complement, but never replace, Unity Play Mode.
const unity = (name: string) => readFileSync(
  path.join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", name),
  "utf8",
);

test("NPC click shares the Input System pipeline and avoids duplicate legacy mouse events", () => {
  const selector = unity("Combat/TargetSelector.cs");
  const click = unity("NPC/ClickInteract.cs");
  assert.match(selector, /GetComponentInParent<ClickInteract>\(\)/);
  assert.match(selector, /npcInteract\.Interact\(\)/);
  assert.match(click, /public void Interact\(\)/);
  assert.doesNotMatch(click, /void OnMouseDown\(/);
  assert.match(click, /network\.Shop\.SendOpenShop\(npc\.id\)/);
  assert.match(click, /network\.Bank\.SendOpenBank\(npc\.id\)/);
});

test("Bank/Shop UI references are resolved when the packet arrives", () => {
  const context = unity("Networking/Context/NetworkContext.cs");
  const shopHandler = unity("Networking/Handlers/ShopWindowHandler.cs");
  const bankHandler = unity("Networking/Handlers/BankWindowHandler.cs");
  assert.match(context, /public ShopUI ShopUI\s*=>\s*global::ShopUI\.Instance/);
  assert.match(context, /public BankUI BankUI\s*=>\s*global::BankUI\.Instance/);
  assert.match(shopHandler, /\[ShopWindowHandler\] shopWindow recebido/);
  assert.match(bankHandler, /\[BankWindowHandler\] bankWindow recebido/);
});

test("Unity bank scene links inventoryGoldText to its existing TextMeshPro", () => {
  const scene = readFileSync(
    path.join(process.cwd(), "..", "Client", "Assets", "scenebasic.unity"),
    "utf8",
  );
  assert.match(scene, /m_Name: GoldText[\s\S]*?&1401860594[\s\S]*?TextMeshProUGUI/);
  assert.match(scene, /inventoryGoldText: \{fileID: 1401860594\}/);
});
