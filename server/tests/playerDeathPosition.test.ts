import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { WebSocketServer } from "../src/network/websocket/wsServer";

test("death sends current stats, authoritative position and target reset", (t) => {
  const world = new World();
  world.generateMap(10, 10);
  const player = new Player("player-death-sync", "Tester", 4, 3);
  player.hp = 0;
  player.currentTargetId = "monster";
  world.addPlayer(player);

  const packets: Array<{ playerId: string; packet: Record<string, unknown> }> = [];
  t.mock.method(WebSocketServer, "getInstance", () => ({
    sendToPlayer(playerId: string, payload: string) {
      packets.push({ playerId, packet: JSON.parse(payload) });
    },
  } as unknown as WebSocketServer));

  DeathSystem.handleDeath(player, undefined, world);

  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.currentTargetId, undefined);
  assert.deepEqual(packets.map(x => x.packet.type), [
    "playerStats", "position", "autoAttackStopped",
  ]);
  assert.ok(packets.every(x => x.playerId === player.id));
  assert.deepEqual(packets[1].packet, { type: "position", x: 0, y: 0 });
  assert.equal(packets[0].packet.hp, player.maxHp);
  assert.equal(packets[2].packet.reason, "Jogador morreu.");
});

test("death still restores HP and resets target without WebSocket", (t) => {
  t.mock.method(WebSocketServer, "getInstance", () => undefined);
  const world = new World();
  world.generateMap(10, 10);
  const player = new Player("offline-player", "Tester", 3, 3);
  world.addPlayer(player);
  player.hp = 0;
  player.currentTargetId = "monster";
  DeathSystem.handleDeath(player, undefined, world);
  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.currentTargetId, undefined);
});
