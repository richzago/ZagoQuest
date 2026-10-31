/**
 * Fase 3.1: regression evidence for existing gameplay contracts.
 *
 * The tests intentionally DO NOT invent new rules for XP sharing, selling
 * stock or critical immunity. They document the behavior currently coded.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CombatFormula } from "../src/game/systems/combatFormula";
import { CombatSystem } from "../src/game/combat/combatSystem";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { LootSystem } from "../src/game/systems/lootSystem";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { ShopSystem } from "../src/game/systems/shopSystem";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { Npc } from "../src/game/entities/npc";
import { World } from "../src/game/world/World";
import { DamageType } from "../src/shared/enums/damageType.enum";
import { Vocation } from "../src/shared/enums/vocation.enum";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import type { CombatStats } from "../src/shared/interfaces/combat.interface";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import type { MonsterDeathEventData } from "../src/shared/interfaces/eventData.interface";

const type: MonsterType = {
  id: "audit-dummy", name: "Dummy", level: 1,
  stats: { hp: 6 },
  combat: { xp: 20, damageMin: 1, damageMax: 2 },
  loot: [], ai: { type: "passive", fleeHp: 2 },
  visual: { symbol: "D" },
};

function createWorld() {
  const world = new World();
  world.generateMap(25, 25);
  return world;
}

test("fórmula aplica defesa, armadura, critical, resistência e fraqueza na ordem atual", (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const attacker: CombatStats = {
    attack: 30, defense: 0, armor: 0,
    criticalChance: 100, criticalMultiplier: 2,
  };
  const defender: CombatStats = {
    attack: 0, defense: 5, armor: 4,
    criticalChance: 0, criticalMultiplier: 1,
  };
  const result = CombatFormula.calculateDamage(
    attacker, defender, DamageType.FIRE,
    { [DamageType.FIRE]: 0.5 },
    { [DamageType.FIRE]: 1.5 },
  );
  // (30-(5+2)) * 1.0 variance = 23, crit 2x=46, resist 0.5,
  // weakness 1.5 => floor(34.5)=34.
  assert.deepEqual(result, { damage: 34, isCritical: true });
});

test("dois atacantes: XP e corpse pertencem ao último golpe no desenho ATUAL", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const world = createWorld();
  const first = new Player("first", "First", 2, 2);
  const second = new Player("second", "Second", 2, 3);
  const monster = new Monster("monster", type, 3, 2, new MonsterAI(), 3, 60_000);
  world.addPlayer(first);
  world.addPlayer(second);
  world.addMonster(monster);
  const deathEvents: MonsterDeathEventData[] = [];
  const onDeath = (data: MonsterDeathEventData) => {
    if (data.world === world) deathEvents.push(data);
  };
  EventSystem.getInstance().on(GameEvent.MONSTER_DEATH, onDeath);
  t.mock.method(CombatFormula, "calculateDamage", () => ({
    damage: 3, isCritical: false,
  }));
  try {
    assert.equal(CombatSystem.attack(first, monster, world), 3);
    assert.equal(monster.hp, 3);
    assert.equal(CombatSystem.attack(second, monster, world), 3);
    assert.equal(monster.hp, 0);
    assert.equal(monster.deathProcessed, true);
    assert.equal(world.corpses.length, 1);
    assert.equal(world.corpses[0].killerId, second.id);
    assert.equal(first.experience, 0);
    assert.equal(second.experience, 20);
    assert.equal(deathEvents.length, 1);
    assert.equal(deathEvents[0].killerId, second.id);
    assert.equal(CombatSystem.attack(first, monster, world), 0);
    assert.equal(world.corpses.length, 1);
    assert.equal(second.experience, 20);
  } finally {
    DeathSystem.cancelPendingTimers(world);
    EventSystem.getInstance().off(GameEvent.MONSTER_DEATH, onDeath);
  }
});

test("recalcular stats e vocação/promocão não acumula bônus no caminho normal", () => {
  const player = new Player("vocation", "Knight", 2, 2);
  player.vocation = Vocation.KNIGHT;
  player.level = 50;
  player.promotionStage = 1;
  player.recalculateStats();
  const stats = {
    attack: player.attack, defense: player.defense, armor: player.armor,
    hp: player.maxHp, mana: player.maxMana,
    crit: player.criticalChance, multi: player.criticalMultiplier,
  };
  player.recalculateStats();
  player.recalculateStats();
  assert.deepEqual({
    attack: player.attack, defense: player.defense, armor: player.armor,
    hp: player.maxHp, mana: player.maxMana,
    crit: player.criticalChance, multi: player.criticalMultiplier,
  }, stats);
  assert.ok(stats.hp > 150);
});

test("venda do domínio retira itens antes de creditar gold e rejeita duplicação", () => {
  const player = new Player("seller", "Seller", 2, 2);
  const npc = new Npc("shop", "Merchant", 3, 2, "Hello", "merchant");
  const itemId = "consumable/health_potion";
  npc.shopItems = [{ itemId, buyPrice: 10, sellPrice: 4, stock: 10 }];
  player.inventory.set(itemId, 3);
  assert.equal(ShopSystem.sellItem(player, npc, itemId, 2), true);
  assert.equal(player.inventory.get(itemId), 1);
  assert.equal(player.gold, 8);
  assert.equal(ShopSystem.sellItem(player, npc, itemId, 2), false);
  assert.equal(player.inventory.get(itemId), 1);
  assert.equal(player.gold, 8);
});

test("aggro e chase: monstro encontra jogador em alcance e caminha em sua direção", () => {
  const world = createWorld();
  const monster = new Monster("chaser", type, 2, 2, new MonsterAI());
  const player = new Player("target", "Target", 4, 2);
  world.addMonster(monster);
  world.addPlayer(player);
  monster.ai.update(monster, world);
  assert.equal(monster.target?.id, player.id);
  assert.deepEqual(monster.position, { x: 3, y: 2 });
});

test("target loss: monstro abandona o alvo quando distância passa de dez tiles", () => {
  const world = createWorld();
  const monster = new Monster("loser", type, 2, 2, new MonsterAI());
  const player = new Player("distant", "Distant", 20, 20);
  world.addMonster(monster);
  world.addPlayer(player);
  monster.target = player;
  monster.ai.update(monster, world);
  assert.equal(monster.target, undefined);
  assert.deepEqual(monster.position, { x: 2, y: 2 });
});

test("flee: monstro com HP baixo tenta se afastar do alvo", () => {
  const world = createWorld();
  const monster = new Monster("flee", type, 4, 4, new MonsterAI());
  const player = new Player("threat", "Threat", 3, 4);
  world.addMonster(monster);
  world.addPlayer(player);
  monster.target = player;
  monster.hp = 2;
  monster.ai.update(monster, world);
  assert.deepEqual(monster.position, { x: 5, y: 4 });
});
