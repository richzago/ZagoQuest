import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { World } from "../src/game/world/World";

test("real Tiled map recognizes custom type=player instead of falling back to (2,2)", () => {
  const world = new World();
  const path = join(process.cwd(), "..", "assets", "maps", "test-map.json");
  const result = MapLoader.loadMap(world, path);
  assert.deepEqual(result.playerSpawn, { x: 15, y: 3 });
  assert.equal(world.width, 30);
  assert.equal(world.height, 20);
});

test("PlayerSpawn accepts Tiled name, built-in type, and custom type property", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-spawn-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "map.json");
  for (const object of [
    { name: "Knight", type: "" },
    { name: "player", type: "" },
    { name: "SomeSpawn", type: "player" },
    { name: "SomeSpawn", type: "", properties: [{ name: "type", type: "string", value: "player" }] },
  ]) {
    writeFileSync(file, JSON.stringify({
      width: 10, height: 10, tilewidth: 32, tileheight: 32,
      layers: [
        { name: "Collision", type: "tilelayer", width: 10, height: 10, data: Array(100).fill(0) },
        { name: "PlayerSpawn", type: "objectgroup", objects: [{ id: 1, x: 64, y: 96, width: 0, height: 0, ...object }] },
      ],
    }));
    const result = MapLoader.loadMap(new World(), file);
    assert.deepEqual(result.playerSpawn, { x: 2, y: 3 }, JSON.stringify(object));
  }
});

test("PlayerSpawn ignores unrelated objects and keeps controlled fallback", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-spawn-negative-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "map.json");
  writeFileSync(file, JSON.stringify({
    width: 5, height: 5, tilewidth: 32, tileheight: 32,
    layers: [
      { name: "Collision", type: "tilelayer", width: 5, height: 5, data: Array(25).fill(0) },
      { name: "PlayerSpawn", type: "objectgroup", objects: [{ id: 1, name: "Other", type: "npc", x: 64, y: 64, width: 0, height: 0 }] },
    ],
  }));
  const result = MapLoader.loadMap(new World(), file);
  assert.equal(result.playerSpawn, undefined);
});
