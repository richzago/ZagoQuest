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


test("C4: PlayerHUD não mantém singleton de cena obsoleto após destroy", () => {
  const hud = readUnity("UI/PlayerHUD.cs");
  assert.match(hud, /if \(Instance != null && Instance != this\)[\s\S]*?Destroy\(gameObject\);\s*return;/);
  assert.match(hud, /void OnDestroy\(\)\s*\{[\s\S]*?if \(Instance == this\) Instance = null;/);
  // A interface mostra os dados enviados pelo Node, sem deduzir HP ou XP.
  assert.match(hud, /public void UpdateStats\(PlayerStatsData stats\)/);
  // C6 centralizou a atualização em DisplayBar (clamp somente visual).
  assert.match(hud, /DisplayBar\(hpSlider, hp, maxHp\)/);
  assert.match(hud, /DisplayBar\(manaSlider, mana, maxMana\)/);
  assert.match(hud, /slider\.value = Mathf\.Clamp\(value, 0, Mathf\.Max\(1, maximum\)\)/);
  // C6 compacta: o HUD oculta XP, mantendo levelXP no contrato para destaque.
  assert.match(hud, /xpSlider\.gameObject\.SetActive\(false\)/);
  assert.match(hud, /xpText\.gameObject\.SetActive\(false\)/);
  assert.match(hud, /stats\.levelXpToNext > 0/);
  assert.match(hud, /stats\.levelXp \/ stats\.levelXpToNext >= 0\.9/);
});

test("C4: troca de alvo nunca interrompe alvo anterior para selecionar monstro inexistente", () => {
  const selector = readUnity("Combat/TargetSelector.cs");
  const start = selector.indexOf("public void SelectTarget(string targetId)");
  const end = selector.indexOf("public void ClearTarget()", start);
  assert.ok(start > 0 && end > start);
  const select = selector.slice(start, end);
  const lookup = select.indexOf("EntityManager.Instance.GetGameObject(targetId)");
  const empty = select.indexOf("if (nextTarget == null)");
  const oldStop = select.indexOf("network.Combat.SendStopAutoAttack()");
  const update = select.indexOf("currentTargetId = targetId");
  const newStart = select.indexOf("network.Combat.SendStartAutoAttack(targetId)");
  assert.ok(lookup >= 0 && empty > lookup && oldStop > empty &&
    update > oldStop && newStart > update,
    "Verificar existência do alvo antes do STOP anterior e START novo.");
  assert.match(select, /if \(currentTargetId == targetId\) return/);
  assert.doesNotMatch(select, /if \(nextTarget == null\)[\s\S]*?ClearTarget\(\)/,
    "Alvo que despawnou não deve descartar a seleção anterior.");
});

test("C4: protocolo morte, HP, alvo e velocidade continua autoritativo", () => {
  const death = readFileSync(join(process.cwd(), "src/game/systems/deathSystem.ts"), "utf8");
  const attack = readFileSync(join(process.cwd(), "src/game/combat/playerAttackSystem.ts"), "utf8");
  const movement = readFileSync(join(process.cwd(), "src/game/systems/movementSystem.ts"), "utf8");
  const auto = readFileSync(join(process.cwd(), "src/game/core/gameStarter.ts"), "utf8");
  assert.match(death, /PlayerStatsSender\.toPayload\(player\)/);
  assert.match(death, /type: "position", x: player\.position\.x, y: player\.position\.y/);
  assert.match(death, /type: "autoAttackStopped", reason: "Jogador morreu\."/);
  assert.match(attack, /PLAYER_ATTACK_COOLDOWN_MS = 1000/);
  assert.match(attack, /Math\.hypot\([\s\S]*?\) > 1\.5/);
  assert.match(auto, /PlayerAttackSystem\.tryAttack\(player, target, world\)/);
  assert.match(movement, /FASTEST_MOVE_INTERVAL_MS = 75/);
  assert.match(movement, /MIN_MOVE_INTERVAL_MS = 150/);
  assert.match(movement, /lastAcceptedMove\.set\(player, now\)/);
});
