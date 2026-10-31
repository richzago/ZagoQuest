/** Fase 3: movement cadence and creature speeds are authoritative server rules. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { World } from "../src/game/world/World";
import { MovementSystem, getPlayerMoveIntervalMs,
  FASTEST_MOVE_INTERVAL_MS, MIN_MOVE_INTERVAL_MS } from "../src/game/systems/movementSystem";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { GAME_TICK_MS } from "../src/game/core/gameStarter";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

test("level 1 remains 150ms, level gains speed and minimum is capped", () => {
  const player = new Player("p1", "Player", 2, 2);
  assert.equal(getPlayerMoveIntervalMs(player), MIN_MOVE_INTERVAL_MS);
  player.level = 51;
  assert.equal(getPlayerMoveIntervalMs(player), 130);
  player.level = 1000;
  assert.equal(getPlayerMoveIntervalMs(player), FASTEST_MOVE_INTERVAL_MS);
});

test("equipment speed bonus is applied by server, not a client packet", (t) => {
  const player = new Player("p2", "Player", 2, 2);
  player.equipment.set("boots" as never, "equipment/boots/fast");
  t.mock.method(ItemRegistry, "get", () => ({
    id: "equipment/boots/fast", bonuses: { speed: 15 },
  } as ReturnType<typeof ItemRegistry.get>));
  assert.equal(getPlayerMoveIntervalMs(player), 135);
  player.level = 51;
  assert.equal(getPlayerMoveIntervalMs(player), 115);
});

test("level 51 player can perform a confirmed step at 130ms", () => {
  const player = new Player("p3", "Player", 2, 2);
  player.level = 51;
  const world = new World();
  world.generateMap(15, 15);
  assert.equal(MovementSystem.moveTo(player, world, 3, 2, 1000), "moved");
  assert.equal(MovementSystem.moveTo(player, world, 4, 2, 1129), "cooldown");
  assert.equal(MovementSystem.moveTo(player, world, 4, 2, 1130), "moved");
});

const monsterType: MonsterType = {
  id: "slow-rat", name: "Rat",
  stats: { hp: 20, speed: 20 },
  combat: { xp: 5, damageMin: 1, damageMax: 2 },
  ai: { type: "passive" }, visual: { symbol: "R" },
};

test("Rat/Goblin speed=20 does not move every 250ms game tick", (t) => {
  let now = 10000;
  t.mock.method(Date, "now", () => now);
  const world = new World();
  world.generateMap(20, 20);
  const monster = new Monster("rat", monsterType, 10, 10, new MonsterAI(), 4);
  const player = new Player("prey", "Prey", 13, 10);
  world.addMonster(monster);
  world.addPlayer(player);
  assert.equal(GAME_TICK_MS, 250);
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 11, y: 10 });
  now += 250;
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 11, y: 10 });
  now += 1150;
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 12, y: 10 });
});

test("monsters with larger configured speed can step more frequently", (t) => {
  let now = 10000;
  t.mock.method(Date, "now", () => now);
  const world = new World();
  world.generateMap(20, 20);
  const fast: MonsterType = { ...monsterType,
    stats: { hp: 20, speed: 60 } };
  const monster = new Monster("fast", fast, 8, 8, new MonsterAI());
  const player = new Player("prey", "Prey", 12, 8);
  world.addMonster(monster);
  world.addPlayer(player);
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 9, y: 8 });
  now += 599;
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 9, y: 8 });
  now += 1;
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 10, y: 8 });
});
