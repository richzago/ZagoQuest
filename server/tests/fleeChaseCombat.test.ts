/**
 * Critical regression: in an open map a faster player MUST be able to
 * catch a low-HP Rat/Goblin fleeing along a straight corridor, then kill it.
 * This reproduces the user's "last hit only in a corner" report.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { World } from "../src/game/world/World";
import { MovementSystem } from "../src/game/systems/movementSystem";
import { CombatFormula } from "../src/game/systems/combatFormula";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { tickWorld } from "../src/game/core/gameStarter";
import type { WebSocketServer } from "../src/network/websocket/wsServer";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const ratType: MonsterType = {
  id: "fleeing-rat", name: "Rat", level: 2,
  stats: { hp: 20, speed: 20 },
  combat: { xp: 4, damageMin: 1, damageMax: 2 },
  ai: { type: "aggressive", fleeHp: 5 },
  loot: [], visual: { symbol: "R" },
};

test("fleeing Rat in open space can be caught and killed without corner exploit", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let clock = 10_000;
  t.mock.method(Date, "now", () => clock);
  t.mock.method(CombatFormula, "calculateDamage", () =>
    ({ damage: 4, isCritical: false }));
  const world = new World();
  world.generateMap(30, 20);
  const player = new Player("chaser", "Chaser", 4, 8);
  const rat = new Monster("flee-rat", ratType, 10, 8, new MonsterAI(), 5, 60_000);
  rat.hp = 4; // below fleeHp, will flee instead of attacking
  world.addPlayer(player);
  world.addMonster(rat);
  rat.target = player;
  player.currentTargetId = rat.id;

  const messages: string[] = [];
  const ws = {
    broadcastMove: () => {},
    broadcastDespawn: () => {},
    sendToPlayer: (_playerId: string, data: string) => { messages.push(data); },
  } as unknown as WebSocketServer;

  try {
    for (let tick = 0; tick < 30 && rat.hp > 0; tick++) {
      clock = 10_000 + tick * 250;
      tickWorld(world, ws);
      if (rat.hp <= 0) break;

      // Same server-accepted direction that Unity follows, once per ACK.
      // At most one 250ms step: slower than the server's level-1 150ms cap.
      const distance = rat.position.x - player.position.x;
      if (distance > 1) {
        const result = MovementSystem.moveDirection(player, world, "east", clock + 1);
        assert.equal(result, "moved", `tick ${tick}, distance ${distance}`);
      }
    }

    assert.equal(rat.hp, 0, "rat should die before reaching any wall/corner");
    assert.equal(rat.deathProcessed, true);
    assert.equal(world.corpses.length, 1);
    assert.ok(player.position.x < 22, "kill must occur in open corridor");
    assert.ok(player.experience > 0, "single-player XP still awarded");
    assert.ok(messages.some((m) => m.includes("autoAttackStopped")));
  } finally {
    DeathSystem.cancelPendingTimers(world);
  }
});
