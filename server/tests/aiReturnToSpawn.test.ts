import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { Npc } from "../src/game/entities/npc";
import { NpcAI } from "../src/game/ai/npcAI";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const type: MonsterType = {
  id: "ai-return-test", name: "Return Test",
  stats: { hp: 20 },
  combat: { xp: 1, damageMin: 1, damageMax: 2 },
  ai: { type: "passive" },
  visual: { symbol: "M" },
};
const makeWorld = () => {
  const world = new World();
  world.generateMap(12, 12);
  return world;
};

test("NPC parado na origem com radius=0 não se afasta", () => {
  const world = makeWorld();
  const npc = new Npc("npc-0", "Merchant", 4, 4, "Hi", "merchant");
  npc.ai = new NpcAI(4, 4, 0, 1, 2);
  world.addNpc(npc);
  npc.ai.update(npc, world);
  assert.deepEqual(npc.position, { x: 4, y: 4 });
});

test("NPC alinhado ao eixo Y retorna ao spawn sem deslocamento diagonal", () => {
  const world = makeWorld();
  const npc = new Npc("npc-1", "Merchant", 5, 4, "Hi", "merchant");
  npc.ai = new NpcAI(4, 4, 1, 1, 2);
  world.addNpc(npc);
  npc.ai.update(npc, world);
  assert.deepEqual(npc.position, { x: 4, y: 4 });
});

test("monstro com wanderRadius=0 permanece na origem", () => {
  const world = makeWorld();
  const monster = new Monster("monster-0", type, 4, 4, new MonsterAI(), 0, 1000);
  world.addMonster(monster);
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 4, y: 4 });
});

test("monstro alinhado ao eixo Y retorna sem desviar para diagonal", () => {
  const world = makeWorld();
  const monster = new Monster("monster-1", type, 5, 4, new MonsterAI(), 1, 1000);
  monster.spawnX = 4;
  monster.spawnY = 4;
  world.addMonster(monster);
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 4, y: 4 });
});
