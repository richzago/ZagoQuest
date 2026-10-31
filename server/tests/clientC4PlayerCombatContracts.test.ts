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
  assert.match(selector,/network\.Inventory\?\.SendPickupItem\(groundItem\.groundItemId\)/);
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
  assert.match(hud, /xpSlider\.gameObject\.SetActive\(true\)/);
  assert.match(hud, /xpText\.gameObject\.SetActive\(true\)/);
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

test("C7 bugfix: clique único em monstro e corpse usa todos os colliders visíveis", () => {
  const selector = readUnity("Combat/TargetSelector.cs");
  const onClick = selector.slice(selector.indexOf("private void OnMouseClick()"),
    selector.indexOf("private void OnAttackKey()"));
  const hitPick = selector.slice(selector.indexOf("private enum WorldClickKind"),
    selector.indexOf("private bool IsPointerOverUi()"));

  assert.match(onClick, /Collider2D clicked = FindWorldClickCollider\(ray\)/);
  assert.doesNotMatch(onClick, /Physics2D\.GetRayIntersection\(ray\)/);
  assert.match(hitPick, /Physics2D\.GetRayIntersectionAll\(ray\)/);
  assert.match(hitPick, /if \(kind == WorldClickKind\.None\) continue/);
  assert.match(hitPick, /SortingLayer\.GetLayerValueFromID\(sprite\.sortingLayerID\)/);
  assert.match(hitPick, /kind == WorldClickKind\.Corpse \? 4/);
  assert.match(hitPick, /kind == WorldClickKind\.Monster \? 3/);
  assert.match(hitPick, /bestPriority = priority/);

  assert.match(onClick, /var monster = clicked\.GetComponentInParent<MonsterIdentity>\(\)/);
  assert.match(onClick, /var corpse = clicked\.GetComponentInParent<CorpseIdentity>\(\)/);
  assert.match(onClick, /if \(monster != null\)[\s\S]*?SelectTarget\(clickedId\)/);
  assert.match(onClick, /if \(currentTargetId == clickedId\)\s*ClearTarget\(\);\s*else\s*SelectTarget\(clickedId\)/);
  assert.match(onClick, /network\.Inventory\?\.SendLoot\(corpse\.corpseId\)/);
  assert.match(onClick, /else\s*\{\s*ClearTarget\(\)/);
  assert.match(selector, /if \(currentTargetId == targetId\) return/);
  assert.match(selector, /canvas\.renderMode == RenderMode\.WorldSpace/);
  assert.match(selector, /go\.GetComponentInParent<Selectable>\(\) != null/);

  // O Node continua validando loot e dano; não ampliar alcance pelo cliente.
  const loot = readFileSync(join(process.cwd(), "src/network/handlers/loot.handler.ts"), "utf8");
  assert.match(loot, /if \(dx \+ dy > 2\)/);
  const attack = readFileSync(join(process.cwd(), "src/network/handlers/attack.handler.ts"), "utf8");
  assert.match(attack, /PlayerAttackSystem\.validateSelectableTarget\(player, target, ctx\.world\)/);
});

test("C7 bugfix: ordem de colisores não determina interação por sorte", () => {
  type Clickable = { type: "monster" | "corpse" | "npc" | "item" | "scenery";
    layer: number; sorting: number; distance: number };
  const rank: Record<Clickable["type"], number> =
    { corpse: 4, monster: 3, item: 2, npc: 1, scenery: -1 };
  const choose = (colliders: Clickable[]) => colliders
    .filter(c => c.type !== "scenery")
    .sort((a,b) => b.layer - a.layer || b.sorting - a.sorting ||
      rank[b.type] - rank[a.type] || a.distance - b.distance)[0]?.type;
  const corpse: Clickable = {type:"corpse", layer:0, sorting:10, distance:10};
  const monster: Clickable = {type:"monster", layer:0, sorting:10, distance:10};
  const playerCollider: Clickable = {type:"scenery", layer:0, sorting:100, distance:1};
  assert.equal(choose([playerCollider,monster]), "monster");
  assert.equal(choose([monster,playerCollider]), "monster");
  assert.equal(choose([monster,corpse]), "corpse");
  assert.equal(choose([corpse,monster]), "corpse");
  assert.equal(choose([playerCollider]), undefined);
  assert.equal(choose([{...monster,sorting:12},corpse]), "monster");
});

test("C7 regression PR #110: raycast UI transparente NÃO deve descartar ataque e loot", () => {
  const selector = readUnity("Combat/TargetSelector.cs");
  const ui = selector.slice(selector.indexOf("private static bool BlocksWorldClick("),
    selector.indexOf("private static bool IsTyping()"));
  assert.match(ui, /go\.GetComponentInParent<Canvas>\(\)/);
  assert.match(ui, /canvas\.renderMode == RenderMode\.WorldSpace/);
  assert.match(ui, /go\.GetComponentInParent<Selectable>\(\) != null/);
  assert.match(ui, /go\.GetComponentInParent<C6WindowDragHandle>\(\) != null/);
  assert.match(ui, /graphic\.color\.a <= 0\.001f/);
  assert.match(ui, /graphic\.canvasRenderer\.GetAlpha\(\) <= 0\.001f/);
  assert.match(ui, /group\.alpha <= 0\.001f/);
  assert.match(ui, /if \(!BlocksWorldClick\(hit\)\) continue/);
  assert.match(ui, /system\.RaycastAll\(pointer, uiHits\)/);

  // Regressão confirmada no YAML original: imagens totalmente transparentes
  // com raycastTarget = true cobrem grandes regiões de tela.
  const scene = readFileSync(join(process.cwd(), "..", "Client",
    "Assets", "scenebasic.unity"), "utf8");
  const documents = scene.split(/(?=^--- !u!)/m);
  for (const name of ["ButtomLeft", "InventoryManager", "LootPanel"]) {
    const gameObject = documents.find(doc =>
      doc.startsWith("--- !u!1 &") && doc.includes("m_Name: " + name + "\n"));
    assert.ok(gameObject, `Faltou GameObject ${name} na cena`);
    const id = gameObject!.match(/^--- !u!1 &(\d+)/)?.[1];
    assert.ok(id);
    const graphic = documents.find(doc =>
      doc.includes(`m_GameObject: {fileID: ${id}}`) &&
      doc.includes("m_RaycastTarget: 1") &&
      /m_Color: \{r: [^}]*a: 0\}/.test(doc));
    assert.ok(graphic, `Cena precisa comprovar overlay transparente/raycast em ${name}`);
  }

  type Hit = { canvas: "overlay" | "world"; alpha: number;
    rendererAlpha?: number; groupAlpha?: number; selectable?: boolean;
    draggable?: boolean };
  const blocks = (h: Hit): boolean => h.canvas !== "world" &&
    (h.groupAlpha ?? 1) > 0.001 &&
    Boolean(h.selectable || h.draggable ||
      (h.alpha > 0.001 && (h.rendererAlpha ?? 1) > 0.001));
  const transparent = {canvas:"overlay",alpha:0} as const;
  assert.equal(blocks(transparent), false, "HUD/ButtomLeft transparente não bloqueia");
  assert.equal(blocks({...transparent,selectable:true}), true, "botão transparente bloqueia");
  assert.equal(blocks({...transparent,draggable:true}), true, "header de arraste bloqueia");
  assert.equal(blocks({canvas:"overlay",alpha:1}), true, "janela visível bloqueia");
  assert.equal(blocks({canvas:"world",alpha:1,selectable:true}), false,
    "barra HP worldspace não bloqueia");
  assert.equal(blocks({canvas:"overlay",alpha:1,groupAlpha:0}), false,
    "painel escondido por CanvasGroup não bloqueia");
  assert.equal(blocks({canvas:"overlay",alpha:1,groupAlpha:0,selectable:true}), false,
    "botão de painel completamente invisível não bloqueia");
  assert.equal(blocks({canvas:"overlay",alpha:1,rendererAlpha:0}), false,
    "Graphic com CanvasRenderer oculto não bloqueia");
  assert.equal([transparent, {canvas:"world",alpha:1} as Hit].some(blocks), false,
    "duas camadas decorativas não capturam clique");
  assert.equal([transparent, {canvas:"overlay",alpha:1} as Hit].some(blocks), true,
    "painel realmente visível continua protegido");
});
