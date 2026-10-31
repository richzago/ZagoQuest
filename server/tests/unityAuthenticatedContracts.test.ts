/** Contratos da migração Unity/REST/WS da Fase 5; não substituem C# Play Mode. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const unityRoot = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", "Networking");
const source = (name: string) => readFileSync(join(unityRoot, name), "utf8");

test("Unity negocia identidade do personagem e não envia comandos antes do ACK", () => {
  const network = source("NetworkManager.cs");
  assert.match(network, /requireAuthenticatedSession = true/);
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

test("C0: cena principal habilita WS JWT e inclui login QA sem guardar tokens em YAML", () => {
  const scene = readFileSync(join(process.cwd(), "..", "Client", "Assets", "scenebasic.unity"), "utf8");
  assert.match(scene, /m_EditorClassIdentifier: Assembly-CSharp::NetworkManager[\\s\\S]*?requireAuthenticatedSession: 1/);
  const loginMeta = readFileSync(join(unityRoot, "SessionLoginDebugUI.cs.meta"), "utf8");
  const guid = loginMeta.match(/guid: ([0-9a-f]{32})/)?.[1];
  assert.ok(guid, "Login UI tem GUID estável");
  assert.ok(scene.includes("guid: " + guid + ", type: 3"), "Login UI anexada à cena");
  assert.doesNotMatch(scene, /_sessionToken:|_sessionCharacterId:|JWT_SECRET/);
});

test("C0: importação do tileset de parede preserva nomes/gids e recurso no Unity", () => {
  const root = join(process.cwd(), "..", "Client", "Assets", "Resources", "Tilesets");
  const fs = require("node:fs");
  assert.ok(fs.existsSync(join(root, "[A]Wall-Up1_pipo.png")), "PNG importável pelo Unity");
  const meta = readFileSync(join(root, "[A]Wall-Up1_pipo.png.meta"), "utf8");
  assert.match(meta, /spriteMode: 2/);
  for (let index = 0; index < 5; index++) {
    assert.ok(meta.includes("'[A]Wall-Up1_pipo_" + index + "'"), "Faltou sprite "+index);
  }
});
