/**
 * Condition time is owned by each application, not by the world tick.
 * Fake wall-clock + interval timers make expirations deterministic.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { ConditionRegistry } from "../src/data/items/conditions/conditionRegistry";
import { ConditionManager } from "../src/game/combat/conditions/conditionManager";
import type { ConditionDefinition } from "../src/shared/interfaces/condition.interface";

const poison: ConditionDefinition = {
  id: "poison", name: "Poison", description: "Timing",
  defaultDuration: 50,
  effects: [{ type: "damage_over_time", amount: 3, tickInterval: 20 }],
};

function setup(t: import("node:test").TestContext, getNow: () => number) {
  t.mock.method(Date, "now", getNow);
  t.mock.method(ConditionRegistry, "get", () => poison);
  const player = new Player("timing-player", "Tester", 2, 2);
  const manager: ConditionManager = player.conditionManager;
  const damage: number[] = [];
  manager.bindDamage((_target, amount) => {
    damage.push(amount);
    return amount;
  });
  t.after(() => manager.clear());
  return { player, manager, damage };
}

test("condition applied after old world ticks does not expire prematurely", (t) => {
  let now = 1_000;
  const { manager } = setup(t, () => now);
  // O ConditionManager foi criado antes de uma longa pausa de mundo.
  now += 10_000;
  manager.apply("poison");
  manager.update();
  assert.equal(manager.has("poison"), true);
  assert.equal(manager.get("poison")!.remainingTime, 50);

  now += 49;
  manager.update();
  assert.equal(manager.has("poison"), true);
  now += 1;
  manager.update();
  assert.equal(manager.has("poison"), false);
});

test("interval cannot tick outside actual duration before next world update", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 10_000;
  const { manager, damage } = setup(t, () => now);
  manager.apply("poison");

  now += 20;
  t.mock.timers.tick(20);
  assert.deepEqual(damage, [3]);

  now += 30; // duração encerra em 50ms, antes do próximo tick do mundo
  // 25ms atravessa claramente o próximo limite do intervalo falso (40ms):
  // evita depender de comportamento exato na borda do relógio mockado.
  t.mock.timers.tick(25);
  assert.deepEqual(damage, [3]);
  assert.equal(manager.has("poison"), false);
});

test("reapplication changes source and restarts periodic tick schedule", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let now = 10_000;
  const { manager, damage } = setup(t, () => now);
  const source = new Player("source", "Source", 3, 2);
  manager.apply("poison", 50, source);
  now += 15;
  t.mock.timers.tick(15);
  assert.deepEqual(damage, []);

  now += 1;
  manager.apply("poison", 50, source);
  now += 5;
  t.mock.timers.tick(5); // antigo intervalo dispararia agora se não fosse cancelado
  assert.deepEqual(damage, []);

  now += 15;
  t.mock.timers.tick(15);
  assert.deepEqual(damage, [3]);
  assert.equal(manager.get("poison")?.remainingTime, 50);
});

test("zero/negative/nonfinite durations never create conditions or timers", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const { manager } = setup(t, () => 10_000);
  for (const duration of [0, -1, Number.NaN, Infinity]) {
    manager.apply("poison", duration);
    assert.equal(manager.has("poison"), false);
  }
});
