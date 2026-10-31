/** Contratos da migração Unity/REST/WS da Fase 5; não substituem C# Play Mode. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unityRoot = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", "Networking");
const source = (name: string) => readFileSync(join(unityRoot, name), "utf8");

test("Unity negocia identidade do personagem e não envia comandos antes do ACK", () => {
  const network = source("NetworkManager.cs");
  assert.match(network, /requireAuthenticatedSession = false/);
  assert.match(network, /_awaitingAuthentication = requireAuthenticatedSession/);
  assert.match(network, /!_awaitingAuthentication/);
  assert.match(network, /type"\] = "authenticate"/);
  assert.match(network, /\["characterId"\] = _sessionCharacterId/);
  assert.match(network, /type == "authenticated"/);
  assert.match(network, /isConnected = true/);
  assert.match(network, /_authRejected/);
  assert.doesNotMatch(network, /PlayerPrefs\.SetString/);
});

test("UI QA faz login REST e lista só personagens da conta para selecionar UUID", () => {
  const ui = source("SessionLoginDebugUI.cs");
  assert.match(ui, /api\/sessions/);
  assert.match(ui, /api\/characters\/account\//);
  assert.match(ui, /SetRequestHeader\("Authorization", "Bearer "/);
  assert.match(ui, /ConfigureAuthenticatedSession\(token, id\)/);
  assert.match(ui, /password = ""/);
  assert.doesNotMatch(ui, /Debug\.Log\([^)]*token/);
  assert.doesNotMatch(ui, /PlayerPrefs/);
});

test("API autenticada fornece UUID real para a seleção de personagem", () => {
  const service = readFileSync(join(process.cwd(), "src", "api", "services", "characterService.ts"), "utf8");
  assert.match(service, /where:\s*\{\s*account:\s*\{\s*id:\s*accountId\s*\}\s*\}/);
  assert.match(service, /select:\s*\{\s*id:\s*true/);
});
