/** C3: testes de contrato C# (não substituem compilação/Play Mode Unity). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", "Networking");
const source = (file: string) => readFileSync(join(root, file), "utf8");

test("C3: NetworkContext resolve todos os singletons de cena no momento do pacote", () => {
  const context = source("Context/NetworkContext.cs");
  for (const name of [
    "GameManager","EntityManager","ChatUI","LootUI","TargetSelector","NameplateManager",
    "InventoryUI","EquipmentUI","ShopUI","BankUI","PlayerHUD","StatusManager",
  ]) {
    assert.match(context, new RegExp("public " + name + " " + name +
      String.raw`\s*=>\s*global::` + name + String.raw`\.Instance;`),
      name + " deve ser obtido dinamicamente da cena");
    assert.doesNotMatch(context, new RegExp(name + String.raw`\s*=\s*` + name + String.raw`\.Instance`),
      name + " não deve guardar referência antiga no construtor");
  }
  assert.match(context, /NetworkManager = networkManager/);
  assert.doesNotMatch(context, /private\s+(?:static\s+)?(?:Dictionary|List|GameObject)/,
    "O contexto não deve gerenciar estado de entidades");
});

test("C3: NetworkManager renova contexto por conexão e não despacha antes de autenticar", () => {
  const sourceCode = source("NetworkManager.cs");
  assert.match(sourceCode, /_context = new NetworkContext\(this\)/);
  assert.match(sourceCode, /type == "authenticated" && requireAuthenticatedSession/);
  assert.match(sourceCode, /json\["characterId"\]\?\.ToString\(\) != _sessionCharacterId/);
  assert.match(sourceCode, /requireAuthenticatedSession && !isConnected\) return/);
  assert.match(sourceCode, /json\["playerId"\]\?\.ToString\(\) != _sessionCharacterId/);
  assert.match(sourceCode, /ReferenceEquals\(_websocket, socket\)/);
});
