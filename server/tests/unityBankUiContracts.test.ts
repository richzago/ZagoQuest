/**
 * Tests de regressão de integração C# / cena Unity (inspeção estática).
 * A CI Node não compila Unity: Play Mode segue obrigatório.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const readUnity = (relativePath: string) =>
  readFileSync(join(process.cwd(), "..", "Client", "Assets", relativePath), "utf8");

test("BankUI registra depositar/sacar apenas uma vez e lê campo numérico", () => {
  const ui = readUnity("Resources/Scripts/UI/BankUI.cs");
  assert.match(ui, /depositButton\.onClick\.AddListener\(Deposit\)/);
  assert.match(ui, /withdrawButton\.onClick\.AddListener\(Withdraw\)/);
  assert.match(ui, /closeButton\.onClick\.AddListener\(CloseBank\)/);
  assert.match(ui, /TMP_InputField\.ContentType\.IntegerNumber/);
  assert.match(ui, /int\.TryParse\(amountInput\.text\.Trim\(\), out amount\)/);
  assert.match(ui, /amount <= 0/);
  assert.match(ui, /NetworkManager\.Instance\.Bank\.SendDeposit\(amount\)/);
  assert.match(ui, /NetworkManager\.Instance\.Bank\.SendWithdraw\(amount\)/);
  assert.match(ui, /depositButton\.onClick\.RemoveListener\(Deposit\)/);
  assert.match(ui, /withdrawButton\.onClick\.RemoveListener\(Withdraw\)/);
});

test("BankUI nunca credita gold localmente antes de bankResult do servidor", () => {
  const ui = readUnity("Resources/Scripts/UI/BankUI.cs");
  const transferMethods = ui.slice(ui.indexOf("private void Deposit()"), ui.indexOf("private void ShowLocalError("));
  assert.doesNotMatch(transferMethods, /UpdateBalances\(/);
  assert.match(ui, /if \(!success\) return;\s*\n\s*UpdateBalances\(bankGold, inventoryGold\)/);
  assert.match(ui, /if \(bankPanel == null \|\| !bankPanel\.activeInHierarchy/);
});

test("scenebasic serializa input e botões corretos do BankManager", () => {
  const scene = readUnity("scenebasic.unity");
  const config = scene.match(/m_EditorClassIdentifier: Assembly-CSharp::BankUI[\s\S]{0,450}/)?.[0] ?? "";
  assert.match(config, /bankPanel: \{fileID: 876531502\}/);
  assert.match(config, /bankGoldText: \{fileID: 485166457\}/);
  assert.match(config, /inventoryGoldText: \{fileID: 1401860594\}/);
  assert.match(config, /amountInput: \{fileID: 1065404751\}/);
  assert.match(config, /depositButton: \{fileID: 1398836788\}/);
  assert.match(config, /withdrawButton: \{fileID: 1587952425\}/);
  // The scene's OnClick persistent callbacks are intentionally empty;
  // BankUI.Start registers one callback on each button.
  for (const id of ["1398836788", "1587952425"]) {
    const button = scene.split(`--- !u!114 &${id}\n`)[1]?.split("--- !u!")[0] ?? "";
    assert.match(button, /m_OnClick:\s*\n\s*m_PersistentCalls:\s*\n\s*m_Calls: \[\]/);
  }
});
