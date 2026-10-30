import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { Player } from "../src/game/entities/player";
import { MonsterLoader } from "../src/game/loaders/monsterLoader";
import { MonsterRegistry } from "../src/data/monsters/monsterRegistry";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import { EventSystem } from "../src/game/core/events/eventSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import type { MonsterDeathEventData } from "../src/shared/interfaces/eventData.interface";

const type: MonsterType = {
  id: "test/monster_spawns/rat",
  name: "Rat (test)",
  level: 1,
  stats: { hp: 20 },
  combat: { xp: 4, damageMin: 1, damageMax: 2 },
  loot: [],
  ai: { type: "aggressive" },
  visual: { symbol: "R" },
};

const createWorld = () => {
  const world = new World();
  world.generateMap(20, 20);
  MonsterRegistry.getAll().set(type.id, type);
  return world;
};
const makeMonster = (id: string, spawnId?: string, respawnTime = 30) =>
  new Monster(id, type, 2, 2, new MonsterAI(), 2, respawnTime, spawnId);

test("MonsterRegistry encontra JSONs quando executado da pasta server", () => {
  MonsterRegistry.loadAll();
  assert.equal(MonsterRegistry.get("rat")?.id, "rat");
});

test("um ponto Tiled cria exatamente um monstro e um spawnPoint", () => {
  const world = createWorld();
  MonsterLoader.spawnMonsters(world, [
    { monsterId: type.id, x: 2, y: 2, radius: 2, respawnTime: 1000 },
  ]);
  assert.equal(world.monsters.length, 1);
  assert.equal(world.spawnPoints.length, 1);

  const monster = world.monsters[0];
  assert.equal(monster.spawnPointId, world.spawnPoints[0].id);
  assert.notEqual(monster.id, monster.spawnPointId); // ID da vida != ID do ponto
  assert.equal(monster.respawnTime, 1000);
  assert.equal(monster.wanderRadius, 2);
});

test("pontos distintos geram monstros independentes, mesmo na mesma posição", () => {
  const world = createWorld();
  MonsterLoader.spawnMonsters(world, [
    { monsterId: type.id, x: 2, y: 2 },
    { monsterId: type.id, x: 2, y: 2 },
    { monsterId: type.id, x: 3, y: 2 },
  ]);
  assert.equal(world.monsters.length, 3);
  assert.equal(world.spawnPoints.length, 3);
  assert.equal(new Set(world.monsters.map((m) => m.id)).size, 3);
  assert.equal(new Set(world.spawnPoints.map((p) => p.id)).size, 3);
});

test("pontos inválidos e monstros ausentes não poluem o mundo", () => {
  const world = createWorld();
  MonsterLoader.spawnMonsters(world, [
    { monsterId: type.id, x: 99, y: 2 },
    { monsterId: type.id, x: 5, y: 5 }, // parede do mapa de teste
    { monsterId: type.id, x: NaN, y: 3 },
    { monsterId: "unknown/monster", x: 2, y: 2 },
    { monsterId: type.id, x: 3, y: 3 },
  ]);
  assert.equal(world.monsters.length, 1);
  assert.equal(world.spawnPoints.length, 1);
});

test("spawnPoint.id repetido não cria duas vidas", () => {
  const world = createWorld();
  MonsterLoader.spawnMonsters(world, [
    { id: "spawn-A", monsterId: type.id, x: 2, y: 2 },
    { id: "spawn-A", monsterId: type.id, x: 3, y: 2 },
  ]);
  assert.equal(world.monsters.length, 1);
  assert.equal(world.spawnPoints.length, 1);
  assert.equal(world.spawnPoints[0].id, "spawn-A");
});

test("World.addMonster impede duplicar a mesma entidade por ID", () => {
  const world = createWorld();
  const monster = makeMonster("same-id");
  world.addMonster(monster);
  world.addMonster(monster);
  world.addMonster(makeMonster("same-id"));
  assert.equal(world.monsters.length, 1);
});

test("monstro com configuração de timer inválida recebe padrão seguro", () => {
  const badTimes = [0, -1, NaN, Infinity, 2.5, 2_147_483_648];
  for (const time of badTimes) {
    const monster = new Monster("bad-time", type, 2, 2, new MonsterAI(), -2, time);
    assert.equal(monster.respawnTime, 10000);
    assert.equal(monster.wanderRadius, 3);
  }
});

test("matar o mesmo monstro duas vezes concede XP e loot só uma vez", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const world = createWorld();
  const killer = new Player("killer", "Tester", 2, 2);
  const monster = makeMonster("monster-1", "spawn-1", 30);
  world.addMonster(monster);

  const eventSystem = EventSystem.getInstance();
  const deaths: string[] = [];
  const onDeath = (event: MonsterDeathEventData) => deaths.push(event.monsterId);
  eventSystem.on(GameEvent.MONSTER_DEATH, onDeath);
  try {
    monster.hp = 0;
    DeathSystem.handleDeath(monster, killer, world);
    DeathSystem.handleDeath(monster, killer, world);

    assert.equal(monster.deathProcessed, true);
    assert.equal(world.corpses.length, 1);
    assert.equal(killer.experience, 4);
    assert.equal(killer.lifetimeExperience, 4);
    assert.deepEqual(deaths, ["monster-1"]);
  } finally {
    eventSystem.off(GameEvent.MONSTER_DEATH, onDeath);
    t.mock.timers.reset();
  }
});

test("respawn cria outra vida com mesmo ponto, mas ID diferente", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const world = createWorld();
    const monster = makeMonster("original", "spawn-A", 30);
    world.addMonster(monster);
    world.spawnPoints.push({ id: "spawn-A", x: 2, y: 2, monsterId: type.id });
    monster.hp = 0;

    DeathSystem.handleDeath(monster, undefined, world);
    world.cleanupDeadMonsters();
    assert.equal(world.monsters.length, 0);

    t.mock.timers.tick(29);
    assert.equal(world.monsters.length, 0);
    t.mock.timers.tick(1);

    assert.equal(world.monsters.length, 1);
    assert.notEqual(world.monsters[0].id, monster.id);
    assert.equal(world.monsters[0].spawnPointId, "spawn-A");
    assert.equal(world.monsters[0].respawnTime, 30);
    assert.equal(world.spawnPoints.length, 1);
    assert.equal(world.monsters[0].hp, world.monsters[0].maxHp);
  } finally {
    t.mock.timers.reset();
  }
});

test("respawn não cria duplicata quando o ponto já tem monstro vivo", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const world = createWorld();
    const monster = makeMonster("original", "spawn-A", 30);
    world.addMonster(monster);
    monster.hp = 0;
    DeathSystem.handleDeath(monster, undefined, world);
    world.cleanupDeadMonsters();
    const another = makeMonster("already-respawned", "spawn-A");
    world.addMonster(another);

    t.mock.timers.tick(30);
    assert.equal(world.monsters.length, 1);
    assert.equal(world.monsters[0], another);
  } finally {
    t.mock.timers.reset();
  }
});

test("não processa morte de monstro que já foi retirado do mundo", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const world = createWorld();
    const killer = new Player("killer", "Tester", 2, 2);
    const monster = makeMonster("removed-monster");
    monster.hp = 0;
    DeathSystem.handleDeath(monster, killer, world);
    assert.equal(world.corpses.length, 0);
    assert.equal(killer.experience, 0);
  } finally {
    t.mock.timers.reset();
  }
});
