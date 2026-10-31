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
  assert.match(ws, /refuseOnline\("alreadyOnline"\)/);
  assert.match(ws, /refuseOnline\("accountAlreadyOnline"\)/);
  assert.match(ws, /const refusal = JSON.stringify\(\{ type: "authRejected", reason \}\)/);
  assert.match(ws, /ws\.send\(refusal, \(\) => \{/);
  assert.match(ws, /ws\.close\(1008, message\)/);
  assert.match(ws, /const duplicateAccount = \(accountId: string\)/);
  assert.match(ws, /this\.broadcast\.registerClient\(ws, current\)/);
  // Recusa deve acontecer antes do attach/snapshot do UUID duplicado.
  assert.ok(ws.indexOf("if (duplicate(identity.characterId))") <
            ws.indexOf("attach(loaded, identity.accountId);"));
});

test("C3: Unity mostra erro específico antes de descartar mensagens pré-ACK", () => {
  const net = read("Client/Assets/Resources/Scripts/Networking/NetworkManager.cs");
  const ui = read("Client/Assets/Resources/Scripts/Networking/SessionLoginDebugUI.cs");
  assert.match(net, /public string AuthenticationStatusMessage \{ get; private set; \}/);
  assert.match(net, /type == "authRejected" && requireAuthenticatedSession && !isConnected/);
  assert.match(net, /string reason = json\["reason"\]\?\.ToString\(\)/);
  assert.match(net, /reason == "alreadyOnline"/);
  assert.match(net, /reason == "accountAlreadyOnline"/);
  assert.match(net, /_authRejected = true/);
  assert.ok(net.indexOf('type == "authRejected"') <
            net.indexOf('if (requireAuthenticatedSession && !isConnected) return'));
  assert.match(ui, /network\.AuthenticationStatusMessage/);
  assert.match(ui, /authFeedbackLabel\.text = network\.AuthenticationStatusMessage/);
  assert.match(ui, /new GameObject\("C6AuthenticationFeedback"/);
  // Ao reconectar ou ser recusado, a mensagem ainda aparece em UI compacta.
  assert.match(ui, /network\.isConnected \|\| network\.HasCredentials/);
  assert.match(net, /AuthenticationStatusMessage = ""/);
  assert.doesNotMatch(net, /Debug\.Log[^\n]*_sessionToken/);
  assert.doesNotMatch(ui, /Debug\.Log[^\n]*token/);
});
