import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";

test("addPlayer is idempotent for the same object", () => {
  const world = new World();
  const player = new Player("player-1", "Tester", 2, 2);
  world.addPlayer(player);
  world.addPlayer(player);
  assert.equal(world.players.length, 1);
  assert.equal(world.players[0], player);
});

test("addPlayer rejects another instance with the same player ID", () => {
  const world = new World();
  const first = new Player("player-1", "Tester", 2, 2);
  const duplicate = new Player("player-1", "Tester", 8, 8);
  world.addPlayer(first);
  world.addPlayer(duplicate);
  assert.deepEqual(world.players, [first]);
  assert.deepEqual(first.position, { x: 2, y: 2 });
});

test("addPlayer allows two different player IDs", () => {
  const world = new World();
  world.addPlayer(new Player("player-1", "Tester", 2, 2));
  world.addPlayer(new Player("player-2", "Other", 3, 2));
  assert.deepEqual(world.players.map((player) => player.id), ["player-1", "player-2"]);
});
