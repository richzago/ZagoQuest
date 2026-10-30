import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { Npc } from "../src/game/entities/npc";
import { NpcAI } from "../src/game/ai/npcAI";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const type: MonsterType = {
  id: "ai-corner-monster", name: "Corner Monster",
  stats: { hp: 20 },
  combat: { xp: 1, damageMin: 1, damageMax: 2 },
  ai: { type: "aggressive" },
  visual: { symbol: "M" },
};
function world() {
  const result = new World();
  result.generateMap(12, 12);
  return result;
}

test("monstro em perseguição não atravessa canto bloqueado", () => {
  const w = world();
  const monster = new Monster("monster", type, 2, 2, new MonsterAI());
  const target = new Player("target", "Target", 4, 4);
  monster.target = target;
  w.addMonster(monster);
  w.addPlayer(target);
  w.getTile(3, 2)!.walkable = false;
  monster.ai.update(monster, w);
  assert.deepEqual(monster.position, { x: 2, y: 2 });
});

test("monstro em perseguição anda na diagonal se ambos os lados estão livres", () => {
  const w = world();
  const monster = new Monster("monster", type, 2, 2, new MonsterAI());
  const target = new Player("target", "Target", 4, 4);
  monster.target = target;
  w.addMonster(monster);
  w.addPlayer(target);
  monster.ai.update(monster, w);
  assert.deepEqual(monster.position, { x: 3, y: 3 });
});

test("NPC retornando diagonalmente não corta tile lateral bloqueado", () => {
  const w = world();
  const npc = new Npc("npc", "Merchant", 3, 3, "Oi", "merchant");
  npc.ai = new NpcAI(2, 2, 1, 1);
  w.addNpc(npc);
  w.getTile(2, 3)!.walkable = false;
  npc.ai.update(npc, w);
  assert.deepEqual(npc.position, { x: 3, y: 3 });
});

test("NPC retorna diagonalmente quando os dois tiles laterais estão livres", () => {
  const w = world();
  const npc = new Npc("npc", "Merchant", 3, 3, "Oi", "merchant");
  npc.ai = new NpcAI(2, 2, 1, 1);
  w.addNpc(npc);
  npc.ai.update(npc, w);
  assert.deepEqual(npc.position, { x: 2, y: 2 });
});

test("monstro respeita entidade ocupando um dos tiles laterais", () => {
  const w = world();
  const monster = new Monster("monster", type, 2, 2, new MonsterAI());
  const target = new Player("target", "Target", 4, 4);
  monster.target = target;
  w.addMonster(monster);
  w.addPlayer(target);
  w.addNpc(new Npc("blocker", "Blocker", 3, 2, ""));
  monster.ai.update(monster, w);
  assert.deepEqual(monster.position, { x: 2, y: 2 });
});
