/** Real-world contract guards against the classic endless chase. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { PlayerAttackSystem } from "../src/game/combat/playerAttackSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const unity = (path: string) => readFileSync(
  join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", path),
  "utf8",
);
const type: MonsterType = {
  id: "follow-target", name: "Goblin", stats: { hp: 20, speed: 20 },
  combat: { xp: 5, damageMin: 1, damageMax: 3 },
  ai: { type: "aggressive" }, visual: { symbol: "G" },
};

test("selection can start far away, yet damage requires reach", () => {
  const world = new World();
  world.generateMap(20, 20);
  const player = new Player("p", "Player", 3, 3);
  const monster = new Monster("m", type, 11, 11, new MonsterAI());
  world.addPlayer(player);
  world.addMonster(monster);
  assert.equal(PlayerAttackSystem.validateSelectableTarget(player, monster, world), undefined);
  assert.equal(PlayerAttackSystem.validateTarget(player, monster, world), "Alvo muito longe");
  assert.equal(PlayerAttackSystem.tryAttack(player, monster, world).ok, false);
  assert.equal(monster.hp, monster.maxHp);
  monster.position = { x: 4, y: 4 };
  assert.equal(PlayerAttackSystem.validateTarget(player, monster, world), undefined);
});

test("Unity follow uses player authoritative position and one acked move per step", () => {
  const selector = unity("Combat/TargetSelector.cs");
  const controller = unity("Player/PlayerController.cs");
  assert.match(selector, /PlayerController\.Instance\.RequestFollowTowards\(currentTarget\.transform\.position\)/);
  assert.doesNotMatch(selector, /Vector2 playerPos = transform\.position/);
  assert.doesNotMatch(selector, /for \(int i = 0; i < Mathf\.Min\(steps, 3\)/);
  assert.match(controller, /if \(followPending\)/);
  assert.match(controller, /if \(Mathf\.Max\(Mathf\.Abs\(dx\), Mathf\.Abs\(dy\)\) <= 1\) return;/);
  assert.match(controller, /OnPositionReceived\(Vector2 pos\)/);
  assert.match(controller, /followPending = false;/);
  assert.doesNotMatch(controller, /moveQueue\.Enqueue/);
});
