/** C3 — evidência de feedback Unity + contrato Node; Unity C# exige QA em Play Mode. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const read = (p: string) => readFileSync(join(process.cwd(), "..", p), "utf8");

test("C3: Node informa motivo de UUID já conectado antes do fechamento 1008", () => {
  const ws = read("server/src/network/websocket/wsServer.ts");
  assert.match(ws, /if \(duplicate\(identity\.characterId\)\)/);
  assert.match(ws, /type: "authRejected"/);
  assert.match(ws, /reason: "alreadyOnline"/);
  assert.match(ws, /ws\.send\(refusal, \(\) => \{/);
  assert.match(ws, /ws\.close\(1008, "Personagem ja conectado\."\)/);
  assert.match(ws, /this\.broadcast\.registerClient\(ws, current\)/);
  // Recusa deve acontecer antes do attach/snapshot do UUID duplicado.
  assert.ok(ws.indexOf("if (duplicate(identity.characterId))") <
            ws.indexOf("attach(loaded);"));
});

test("C3: Unity mostra erro específico antes de descartar mensagens pré-ACK", () => {
  const net = read("Client/Assets/Resources/Scripts/Networking/NetworkManager.cs");
  const ui = read("Client/Assets/Resources/Scripts/Networking/SessionLoginDebugUI.cs");
  assert.match(net, /public string AuthenticationStatusMessage \{ get; private set; \}/);
  assert.match(net, /type == "authRejected" && requireAuthenticatedSession && !isConnected/);
  assert.match(net, /json\["reason"\]\?\.ToString\(\) == "alreadyOnline"/);
  assert.match(net, /_authRejected = true/);
  assert.ok(net.indexOf('type == "authRejected"') <
            net.indexOf('if (requireAuthenticatedSession && !isConnected) return'));
  assert.match(ui, /manager\.AuthenticationStatusMessage/);
  assert.match(ui, /GUILayout\.Label\(manager\.AuthenticationStatusMessage\)/);
  assert.match(net, /AuthenticationStatusMessage = ""/);
  assert.doesNotMatch(net, /Debug\.Log[^\n]*_sessionToken/);
  assert.doesNotMatch(ui, /Debug\.Log[^\n]*token/);
});
