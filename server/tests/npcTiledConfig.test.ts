/** Tiled → MapLoader → NpcLoader → NpcAI contract tests. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
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
    x: 2, y: 1, npcId: "merchant", objectId: 1, radius: 1, interactionRadius: 1, moveCooldown: 2500,
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

test("dois NPCSpawn do mesmo template mantêm IDs distintos e estáveis no snapshot", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-npc-multi-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const mapFile = join(dir, "map.json");
  const shopProps = [{ name: "npcId", type: "string", value: "merchant" }];
  writeFileSync(mapFile, JSON.stringify({
    width: 10, height: 10, tilewidth: 32, tileheight: 32,
    layers: [
      { name: "Collision", type: "tilelayer", width: 10, height: 10, data: Array(100).fill(0) },
      { name: "NPCSpawn", type: "objectgroup", width: 10, height: 10, objects: [
        { id: 30, name: "A", type: "npc", x: 32, y: 32, width: 0, height: 0, properties: shopProps },
        { id: 31, name: "B", type: "npc", x: 128, y: 32, width: 0, height: 0, properties: shopProps },
      ] },
    ],
  }));
  const world = new World();
  const spawns = MapLoader.loadMap(world, mapFile).npcs!;
  assert.deepEqual(spawns.map(s => s.objectId), [30, 31]);

  NpcLoader.loadNpcsFromTiled(world, spawns);
  assert.deepEqual(world.npcs.map(npc => npc.id), ["5@tiled:30", "5@tiled:31"]);
  assert.deepEqual(world.npcs.map(npc => npc.position), [{ x: 1, y: 1 }, { x: 4, y: 1 }]);
  assert.deepEqual(world.npcs.map(npc => npc.npcType), ["merchant", "merchant"]);

  NpcLoader.loadNpcsFromTiled(world, spawns); // recarga não duplica entidades
  assert.equal(world.npcs.length, 2);
});

test("NPCSpawn em parede, fora do mapa ou em posição ocupada não entra no mundo", () => {
  const world = new World();
  world.generateMap(10, 10);
  world.getTile(3, 2)!.walkable = false;
  world.addPlayer(new Player("player", "Tester", 5, 2));
  NpcLoader.loadNpcsFromTiled(world, [
    { npcId: "banker", objectId: 1, x: 99, y: 2 },
    { npcId: "banker", objectId: 2, x: 3, y: 2 },
    { npcId: "banker", objectId: 3, x: 5, y: 2 },
    { npcId: "banker", objectId: 4, x: 6, y: 2 },
  ]);
  assert.deepEqual(world.npcs.map(npc => npc.id), ["6@tiled:4"]);
});

test("World.addNpc não aceita IDs duplicados, mas aceita instâncias distintas", () => {
  const world = new World();
  world.generateMap(10, 10);
  const make = (id: string) => new Npc(id, "Banker", 2, 2, "Hello", "banker");
  const first = make("6@tiled:1");
  world.addNpc(first);
  world.addNpc(first);
  world.addNpc(make("6@tiled:1"));
  world.addNpc(make("6@tiled:2"));
  assert.equal(world.npcs.length, 2);
  assert.equal(world.npcs[0], first);
});
