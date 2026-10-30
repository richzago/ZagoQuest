import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";

test("generating a second fallback map replaces tiles instead of retaining stale collisions", () => {
  const world = new World();
  world.generateMap(12, 12);
  assert.equal(world.tiles.size, 144);
  world.getTile(7, 7)!.walkable = false;

  world.generateMap(3, 2);
  assert.equal(world.width, 3);
  assert.equal(world.height, 2);
  assert.equal(world.tiles.size, 6);
  assert.equal(world.getTile(7, 7), undefined);
  assert.equal(world.getTile(1, 1)?.walkable, true);

  world.generateMap(12, 12);
  assert.equal(world.getTile(7, 7)?.walkable, true);
  assert.equal(world.getTile(5, 5)?.walkable, false); // fallback test wall
});

test("map dimensions must be positive safe integers; invalid attempts do not mutate map", () => {
  const world = new World();
  world.generateMap(4, 4);
  for (const [width, height] of [[0, 3], [-1, 3], [3.5, 3], [NaN, 2], [2, Infinity],
    [Number.MAX_SAFE_INTEGER + 1, 2]]) {
    assert.throws(() => world.generateMap(width, height), /Dimensões/);
    assert.equal(world.width, 4);
    assert.equal(world.height, 4);
    assert.equal(world.tiles.size, 16);
  }
});

test("tile bounds reject unsafe or fractional coordinates", () => {
  const world = new World();
  world.generateMap(4, 4);
  for (const [x, y] of [[NaN, 1], [Infinity, 2], [-1, 1], [1, 4], [1.5, 1],
    [Number.MAX_SAFE_INTEGER + 1, 0]]) {
    assert.equal(world.isWithinBounds(x, y), false);
  }
  assert.equal(world.isWithinBounds(0, 0), true);
  assert.equal(world.isWithinBounds(3, 3), true);
});
