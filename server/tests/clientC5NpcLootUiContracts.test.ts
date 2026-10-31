/**
 * C5 UI ↔ World: contratos estáticos Unity e Node.
 * A CI de TypeScript NÃO compila nem renderiza C#/Unity — Play Mode é obrigatório.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unity = (name:string) => readFileSync(join(
  process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", name), "utf8");
const server = (name:string) => readFileSync(join(process.cwd(),"src", name),"utf8");
const scene = () => readFileSync(join(
  process.cwd(),"..","Client","Assets","scenebasic.unity"),"utf8");

test("C5: a janela de loot usa scroll e uma linha clicável por item, sem TMP capturar raycast", () => {
  const ui=unity("UI/LootUI.cs"), row=unity("UI/LootItemSlot.cs"), layout=unity("UI/WorldWindowLayout.cs");
  assert.match(ui,/WorldWindowLayout\.PrepareList\(itemsContainer\)/);
  assert.match(ui,/WorldWindowLayout\.PrepareRow\(slot, 56f, i % 2 == 1\)/);
  assert.match(ui,/WorldWindowLayout\.PrepareRow\(slot/);
  assert.match(layout,/group\.childControlWidth = true/);
  assert.match(layout,/group\.childControlHeight = true/);
  assert.match(layout,/group\.childForceExpandHeight = false/);
  assert.match(layout,/fitter\.verticalFit = ContentSizeFitter\.FitMode\.PreferredSize/);
  assert.match(layout,/scroll\.horizontal = false/);
  assert.match(layout,/scroll\.vertical = true/);
  assert.match(layout,/text\.raycastTarget = false/);
  assert.match(row,/IPointerClickHandler/);
  assert.match(row,/eventData\.button == PointerEventData\.InputButton\.Left/);
  assert.doesNotMatch(row,/clickCount == 2/,"Coleta individual não deve exigir duplo clique.");
  assert.match(ui,/closeButton = closeTransform\.GetComponent<Button>\(\)/);
  assert.match(ui,/rootRaycaster\.raycastTarget = false/);
  const s=scene();
  assert.match(s,/m_EditorClassIdentifier: Assembly-CSharp::LootUI[\s\S]{0,300}closeButton: \{fileID: 0\}/);
  assert.match(s,/m_Name: LootPanel/);
});

test("C5: takeLoot individual nunca fecha janela até esgotar os itens; ACK mantém indices corretos", () => {
  const ui=unity("UI/LootUI.cs");
  const handler=unity("Networking/Handlers/LootTakenHandler.cs");
  const err=unity("Networking/Handlers/LootErrorHandler.cs");
  const sender=unity("Networking/Senders/InventorySender.cs");
  assert.match(ui,/awaitingServer = true/);
  assert.match(ui,/public void OnLootTaken\(string corpseId, int\? itemIndex\)/);
  assert.match(ui,/if \(corpseId != currentCorpseId\) return/);
  assert.match(ui,/visibleItems\.RemoveAt\(itemIndex\.Value\)/);
  assert.match(ui,/RebuildRows\(\)/);
  assert.match(ui,/OnLootError\(string message\)/);
  assert.match(handler,/context\.LootUI\?\.OnLootTaken\(id, index\)/);
  assert.match(handler,/json\["itemIndex"\]\?\.Type == JTokenType\.Integer/);
  assert.match(err,/context\.LootUI\?\.OnLootError/);
  assert.doesNotMatch(handler,/CloseLootWindow/);
  assert.match(sender,/SendTakeLoot\(string corpseId, bool takeAll = true, int itemIndex = -1\)/);
  const loot=server("network/handlers/loot.handler.ts");
  assert.match(loot,/corpse\.loot\.splice\(msg\.itemIndex!, 1\)/);
  assert.match(loot,/sendLootTaken\(corpse\.id, msg\.itemIndex\)/);
  const packets=server("network/senders/lootSender.ts");
  assert.match(packets,/sendLootTaken\(corpseId: string, itemIndex\?: number\)/);
});

test("C5: loja e banco usam mesma identidade visual sem alterar autoridade economica", () => {
  const shop=unity("UI/ShopUI.cs"), item=unity("NPC/ShopItemSlot.cs");
  const bank=unity("UI/BankUI.cs"), layout=unity("UI/WorldWindowLayout.cs");
  assert.match(shop,/WorldWindowLayout\.PrepareList\(itemsContainer\)/);
  assert.match(shop,/WorldWindowLayout\.PrepareRow\(slot, 76f, i % 2 == 1\)/);
  assert.match(item,/WorldWindowLayout\.Place\(buyButton\.GetComponent<RectTransform>\(\)/);
  assert.match(item,/int\.TryParse\(amountInput\.text, out quantity\)/);
  assert.match(item,/quantity <= 0/);
  assert.match(item,/network\.Shop\.SendBuyItem\(npcId, item\.itemId, quantity\)/);
  assert.match(bank,/WorldWindowLayout\.PreparePanel\(bankPanel, 480f, 370f\)/);
  assert.match(bank,/NetworkManager\.Instance\.Bank\.SendDeposit\(amount\)/);
  assert.match(bank,/NetworkManager\.Instance\.Bank\.SendWithdraw\(amount\)/);
  assert.match(layout,/LayoutElement/);
  assert.doesNotMatch(shop,/Destroy\(gameObject\);\s*\}\s*private void Start/);
  const auth=server("game/systems/npcInteractionSystem.ts");
  assert.match(auth,/export const NPC_INTERACTION_RANGE = 2/);
  assert.match(auth,/!this\.canInteract\(player, world, active\.npc, service\)/);
});


test("C5: Banker identifica o saldo depositado e a carteira sem calcular gold no Unity", () => {
  const ui = unity("UI/BankUI.cs");
  assert.match(ui, /bankGoldText\.text = \$"Saldo no banco: \{bankGold:N0\} gold"/);
  assert.match(ui, /inventoryGoldText\.text = \$"Ouro em mãos: \{inventoryGold:N0\} gold"/);
  assert.match(ui, /if \(!success\) return;\s*UpdateBalances\(bankGold, inventoryGold\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf("private void Deposit()"),ui.indexOf("private void ShowLocalError")),/UpdateBalances\(/);
});

test("C5: Merchant de catálogo permanente oculta estoque e só Node autoriza compras", () => {
  const row=unity("NPC/ShopItemSlot.cs");
  const shop=server("game/systems/shopSystem.ts");
  const handler=server("network/handlers/shop.handler.ts");
  const config=JSON.parse(readFileSync(join(process.cwd(),"src/data/npc/merchant.json"),"utf8"));
  assert.match(row,/stockText\.gameObject\.SetActive\(false\)/);
  assert.doesNotMatch(row,/item\.stock/);
  assert.doesNotMatch(shop,/item\.stock/);
  assert.doesNotMatch(handler,/\bstock:\s*item\.stock/);
  assert.doesNotMatch(handler,/ou estoque/);
  assert.ok(config.shopItems.every((x: Record<string,unknown>)=>!("stock" in x)));
  assert.match(shop,/player\.canAddItem\(itemId, quantity\)/);
  assert.match(shop,/isValidQuantity\(quantity\)/);
  assert.match(shop,/Number\.isSafeInteger\(cost\)/);
  assert.match(shop,/player\.bankGold/);
  assert.match(row,/network\.Shop\.SendBuyItem\(npcId, item\.itemId, quantity\)/);
});
