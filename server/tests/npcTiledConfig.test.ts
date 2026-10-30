/** Tiled → MapLoader → NpcLoader → NpcAI contract tests. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { NpcLoader } from "../src/game/loaders/npcLoader";

test("NPCSpawn settings from Tiled reach NPC AI and govern conversation distance", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-npc-map-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const mapFile = join(dir, "map.json");
  const props = [
    { name: "npcId", type: "string", value: "merchant" },
    { name: "radius", type: "int", value: 1 },
    { name: "interactionRadius", type: "int", value: 1 },
    { name: "moveCooldown", type: "int", value: 2500 },
  ];
  writeFileSync(mapFile, JSON.stringify({
    width: 10, height: 10, tilewidth: 32, tileheight: 32,
    layers: [
      { name: "Collision", type: "tilelayer", width: 10, height: 10, data: Array(100).fill(0) },
      { name: "NPCSpawn", type: "objectgroup", width: 10, height: 10,
        objects: [{ id: 1, name: "Merchant", type: "npc", x: 64, y: 32,
          width: 0, height: 0, properties: props }] },
    ],
  }));
  const world = new World();
  const result = MapLoader.loadMap(world, mapFile);
  assert.deepEqual(result.npcs, [{
    x: 2, y: 1, npcId: "merchant", radius: 1, interactionRadius: 1, moveCooldown: 2500,
  }]);

  NpcLoader.loadNpcsFromTiled(world, result.npcs!);
  assert.equal(world.npcs.length, 1);
  const npc = world.npcs[0];
  const player = new Player("player-npc", "Tester", 4, 1);
  world.addPlayer(player);
  npc.isTalking = true;
  npc.talkingToPlayerId = player.id;
  npc.ai!.update(npc, world);
  assert.equal(npc.isTalking, false, "distance 2 exceeds configured threshold 1");
});

test("NPC AI preserves historical 3-tile default when no valid override exists", () => {
  const world = new World();
  world.generateMap(10, 10);
  NpcLoader.loadNpcsFromTiled(world, [{
    x: 2, y: 1, npcId: "banker",
    interactionRadius: -5, moveCooldown: Number.NaN, radius: -2,
  }]);
  assert.equal(world.npcs.length, 1);
  const npc = world.npcs[0];
  const player = new Player("player-npc", "Tester", 4, 1);
  world.addPlayer(player);
  npc.isTalking = true;
  npc.talkingToPlayerId = player.id;
  npc.ai!.update(npc, world);
  assert.equal(npc.isTalking, true, "distance 2 stays within default threshold 3");
});
