/** Damage-over-time integration with events, XP, death and corpse creation. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { ConditionRegistry } from "../src/data/items/conditions/conditionRegistry";
import type { ConditionDefinition } from "../src/shared/interfaces/condition.interface";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import { DeathSystem } from "../src/game/systems/deathSystem";
import type {
  CombatDamageEventData,
  MonsterDeathEventData,
  PlayerDeathEventData,
} from "../src/shared/interfaces/eventData.interface";

const poison: ConditionDefinition = {
  id: "poison", name: "Poison", description: "Test", defaultDuration: 5000,
  effects: [{ type: "damage_over_time", amount: 5, tickInterval: 100, damageType: "earth" as never }],
};
const type: MonsterType = {
  id: "dot-monster", name: "Rat", level: 1,
  stats: { hp: 12 }, combat: { xp: 20, damageMin: 1, damageMax: 2 },
  loot: [], ai: { type: "passive" }, visual: { symbol: "R" },
};

function fixture() {
  const world = new World();
  world.generateMap(12, 12);
  const player = new Player("killer", "Tester", 2, 2);
  const monster = new Monster("target", type, 3, 2, new MonsterAI(), 2, 60_000);
  world.addPlayer(player);
  world.addMonster(monster);
  return { world, player, monster };
}

function withPoison(t: { mock: { timers: { enable: (args: unknown) => void } } }) {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const original = ConditionRegistry.get;
  ConditionRegistry.get = (id: string) => {
    assert.equal(id, "poison");
    return poison;
  };
  return () => { ConditionRegistry.get = original; };
}

test("poison ticks emit actual applied damage, capped by target HP", (t) => {
  const restore = withPoison(t);
  const { world, player, monster } = fixture();
  const seen: CombatDamageEventData[] = [];
  const onDamage = (value: CombatDamageEventData) => seen.push(value);
  EventSystem.getInstance().on(GameEvent.COMBAT_DAMAGE, onDamage);
  try {
    monster.conditionManager.apply("poison", undefined, player);
    t.mock.timers.tick(100);
    assert.equal(monster.hp, 7);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].damage, 5);
    assert.equal(seen[0].world, world);
    assert.equal(seen[0].attackerId, player.id);
    assert.equal(seen[0].targetHpAfter, 7);
  } finally {
    monster.conditionManager.clear();
    DeathSystem.cancelPendingTimers(world);
    EventSystem.getInstance().off(GameEvent.COMBAT_DAMAGE, onDamage);
    restore();
  }
});

test("fatal poison processes one monster death, corpse and XP for source", (t) => {
  const restore = withPoison(t);
  const { world, player, monster } = fixture();
  monster.hp = 4;
  const deaths: MonsterDeathEventData[] = [];
  const onDeath = (data: MonsterDeathEventData) => deaths.push(data);
  EventSystem.getInstance().on(GameEvent.MONSTER_DEATH, onDeath);
  try {
    const before = player.experience;
    monster.conditionManager.apply("poison", undefined, player);
    t.mock.timers.tick(100);
    assert.equal(monster.hp, 0);
    assert.equal(monster.deathProcessed, true);
    assert.equal(world.corpses.length, 1);
    assert.equal(deaths.length, 1);
    assert.equal(deaths[0].killerId, player.id);
    assert.ok(player.experience > before);
    assert.equal(monster.conditionManager.has("poison"), false);

    t.mock.timers.tick(300);
    assert.equal(world.corpses.length, 1);
    assert.equal(deaths.length, 1);
    assert.equal(monster.deathProcessed, true);
  } finally {
    monster.conditionManager.clear();
    DeathSystem.cancelPendingTimers(world);
    EventSystem.getInstance().off(GameEvent.MONSTER_DEATH, onDeath);
    restore();
  }
});

test("poison on player triggers player death and removes damaging condition", (t) => {
  const restore = withPoison(t);
  const { world, player, monster } = fixture();
  player.hp = 2;
  const deaths: PlayerDeathEventData[] = [];
  const onDeath = (data: PlayerDeathEventData) => deaths.push(data);
  EventSystem.getInstance().on(GameEvent.PLAYER_DEATH, onDeath);
  try {
    player.conditionManager.apply("poison", undefined, monster);
    t.mock.timers.tick(100);
    assert.equal(deaths.length, 1);
    assert.equal(deaths[0].killerId, monster.id);
    assert.equal(player.hp, player.maxHp);
    assert.equal(player.conditionManager.has("poison"), false);
    t.mock.timers.tick(400);
    assert.equal(deaths.length, 1);
  } finally {
    player.conditionManager.clear();
    DeathSystem.cancelPendingTimers(world);
    EventSystem.getInstance().off(GameEvent.PLAYER_DEATH, onDeath);
    restore();
  }
});

test("condition refresh changes the damage source for subsequent ticks", (t) => {
  const restore = withPoison(t);
  const { world, player, monster } = fixture();
  const other = new Player("killer-2", "Second", 4, 2);
  world.addPlayer(other);
  const seen: CombatDamageEventData[] = [];
  const onDamage = (data: CombatDamageEventData) => seen.push(data);
  EventSystem.getInstance().on(GameEvent.COMBAT_DAMAGE, onDamage);
  try {
    monster.conditionManager.apply("poison", undefined, player);
    monster.conditionManager.apply("poison", 4000, other);
    t.mock.timers.tick(100);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].attackerId, other.id);
  } finally {
    monster.conditionManager.clear();
    DeathSystem.cancelPendingTimers(world);
    EventSystem.getInstance().off(GameEvent.COMBAT_DAMAGE, onDamage);
    restore();
  }
});
