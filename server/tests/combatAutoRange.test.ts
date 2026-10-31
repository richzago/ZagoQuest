/** Manual and automatic attack range must follow the same authoritative validator. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { PlayerAttackSystem } from "../src/game/combat/playerAttackSystem";
import { tickWorld } from "../src/game/core/gameStarter";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import type { WebSocketServer } from "../src/network/websocket/wsServer";

const type: MonsterType = {
  id: "reach-monster", name: "Dummy",
  stats: { hp: 20 }, combat: { xp: 5, damageMin: 1, damageMax: 2 },
  ai: { type: "passive" }, visual: { symbol: "D" },
};

function fixture(t: import("node:test").TestContext, x: number, y: number) {
  const world = new World();
  world.generateMap(12, 12);
  const player = new Player("attacker", "Attacker", 2, 2);
  const monster = new Monster("target", type, x, y, new MonsterAI());
  world.addPlayer(player);
  world.addMonster(monster);
  player.currentTargetId = monster.id;
  t.mock.method(monster.ai, "update", () => {}); // IA não interfere no alcance
  const calls: Array<[string, string]> = [];
  t.mock.method(PlayerAttackSystem, "tryAttack", (
    attacker: Player, target: Monster | undefined,
  ) => {
    calls.push([attacker.id, target!.id]);
    return { ok: true as const, damage: 1 };
  });
  const socket = {
    broadcastMove: () => {},
    broadcastDespawn: () => {},
    sendToPlayer: () => {},
  } as unknown as WebSocketServer;
  return { world, player, monster, socket, calls };
}

test("automatic attack reaches the same adjacent diagonal tile as manual attack", (t) => {
  const { world, player, monster, socket, calls } = fixture(t, 3, 3);
  assert.equal(PlayerAttackSystem.validateTarget(player, monster, world), undefined);
  tickWorld(world, socket);
  assert.deepEqual(calls, [[player.id, monster.id]]);
});

test("automatic attack still reaches a cardinal neighbor", (t) => {
  const { world, player, monster, socket, calls } = fixture(t, 3, 2);
  assert.equal(PlayerAttackSystem.validateTarget(player, monster, world), undefined);
  tickWorld(world, socket);
  assert.deepEqual(calls, [[player.id, monster.id]]);
});

test("automatic attack does not hit targets outside the manual attack range", (t) => {
  const { world, player, monster, socket, calls } = fixture(t, 4, 3);
  assert.equal(PlayerAttackSystem.validateTarget(player, monster, world), "Alvo muito longe");
  tickWorld(world, socket);
  assert.deepEqual(calls, []);
});
