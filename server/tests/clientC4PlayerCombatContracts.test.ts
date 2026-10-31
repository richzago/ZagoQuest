/** C4 Player/Combat: asserts estáticos para contratos Unity; não compilam C#. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readUnity = (p:string) =>
  readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");

test("C4: PlayerController libera oito InputActions e limpa Instance entre cenas", () => {
  const player=readUnity("Player/PlayerController.cs");
  const inputs=["moveNorth","moveSouth","moveEast","moveWest",
    "moveNortheast","moveNorthwest","moveSoutheast","moveSouthwest"];
  for (const input of inputs) {
    assert.match(player,new RegExp(input+String.raw`\?\.Enable\(\)`));
    assert.match(player,new RegExp(input+String.raw`\?\.Disable\(\)`));
    assert.match(player,new RegExp(input+String.raw`\?\.Dispose\(\)`));
  }
  assert.match(player,/if \(Instance != this\) return;/);
  assert.match(player,/if \(Instance == this\) Instance = null;/);
  assert.match(player,/transform\.position = new Vector3\(confirmed\.x, confirmed\.y, 0\)/);
  assert.match(player,/if \(!isReady \|\| networkManager == null \|\| !networkManager\.isConnected\) return;/);
});

test("C4: seleção de alvo, loot e pickup não enviam comandos com socket desconectado", () => {
  const selector=readUnity("Combat/TargetSelector.cs");
  assert.match(selector,/var network = NetworkManager\.Instance;/);
  assert.match(selector,/if \(network == null \|\| !network\.isConnected\) return;/);
  assert.match(selector,/var camera = Camera\.main;/);
  assert.match(selector,/if \(camera == null\) return;/);
  assert.match(selector,/network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
  assert.match(selector,/network\.Inventory\?\.SendPickupItem\(item\.groundItemId\)/);
  assert.match(selector,/public void SelectTarget\(string targetId\)/);
  assert.match(selector,/!network\.isConnected \|\| network\.Combat == null/);
  assert.match(selector,/network\.Combat\.SendStartAutoAttack\(targetId\)/);
  assert.match(selector,/network\.Combat\.SendStopAutoAttack\(\)/);
  assert.match(selector,/ClearTargetInternal\(false\)/);
  assert.match(selector,/hadTarget && notifyServer && NetworkManager\.Instance != null/);
});

test("C4: Node segue como autoridade de posição, HP e ritmo de movimento", () => {
  const player=readUnity("Player/PlayerController.cs");
  const position=readUnity("Networking/Handlers/PositionHandler.cs");
  const stats=readUnity("Networking/Handlers/PlayerStatsHandler.cs");
  assert.match(player,/networkManager\.Movement\.SendMoveDir\(dir\)/);
  assert.match(position,/OnPositionReceived\(new Vector2\(posMsg\.x, posMsg\.y\)\)/);
  assert.match(stats,/SetMoveIntervalMs\(stats\.moveIntervalMs\)/);
  assert.match(stats,/context\.PlayerHUD\?\.UpdateStats\(stats\)/);
});
