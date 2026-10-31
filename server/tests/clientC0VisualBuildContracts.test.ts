/** C0 — contrato de cena, build Windows e tema UI; não substitui Play Mode. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const client = join(process.cwd(), "..", "Client");
const resourceScripts = join(client, "Assets", "Resources", "Scripts");
const read = (...parts: string[]) => readFileSync(join(client, ...parts), "utf8");

test("C0: a build Windows aponta para a cena de jogo que recebe login JWT", () => {
  const build = read("ProjectSettings", "EditorBuildSettings.asset");
  const scene = read("Assets", "scenebasic.unity");
  const sceneMeta = read("Assets", "scenebasic.unity.meta");
  const guid = sceneMeta.match(/guid: ([0-9a-f]{32})/)?.[1];
  assert.ok(guid);
  assert.match(build, /path: Assets\/scenebasic\.unity/);
  assert.ok(build.includes("guid: " + guid));
  assert.doesNotMatch(build, /path: Assets\/Scenes\/SampleScene\.unity/);
  assert.match(scene, /requireAuthenticatedSession: 1/);
  assert.match(scene, /Assembly-CSharp::SessionLoginDebugUI/);
});

test("C0: tema gráfico está anexado só à HUD e não altera scripts de networking", () => {
  const scene = read("Assets", "scenebasic.unity");
  const theme = read("Assets", "Resources", "Scripts", "UI", "ZagoQuestUiTheme.cs");
  const meta = read("Assets", "Resources", "Scripts", "UI", "ZagoQuestUiTheme.cs.meta");
  const guid = meta.match(/guid: ([0-9a-f]{32})/)?.[1];
  assert.ok(guid);
  assert.ok(scene.includes("guid: " + guid + ", type: 3"));
  assert.match(theme, /GetComponentsInChildren<Image>\(true\)/);
  assert.match(theme, /GetComponentsInChildren<TextMeshProUGUI>\(true\)/);
  assert.match(theme, /GetComponentsInChildren<Slider>\(true\)/);
  assert.doesNotMatch(theme, /NetworkManager|WebSocket|SendMove|playerStats|InventorySender/);
});

test("C0: movimento não faz spam no Console por tecla/ACK", () => {
  const sender = readFileSync(join(resourceScripts, "Networking", "Senders", "MovementSender.cs"), "utf8");
  assert.match(sender, /SendMoveDir\(string direction\)/);
  assert.match(sender, /Send\(msg\)/);
  assert.doesNotMatch(sender, /Debug\.Log\(\$?"\[MovementSender\] Movendo/);
});
