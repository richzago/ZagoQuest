/** WorldFactory must not confuse bad entity data with unreadable Tiled maps. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { createWorldAndPlayer } from "../src/game/initialization/worldFactory";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { MonsterLoader } from "../src/game/loaders/monsterLoader";
import { NpcLoader } from "../src/game/loaders/npcLoader";
import { PlayerLoader } from "../src/game/loaders/playerLoader";

const originals = {
  map: MapLoader.loadMap,
  monsters: MonsterLoader.spawnMonsters,
  npcs: NpcLoader.loadNpcsFromTiled,
  player: PlayerLoader.loadOrCreatePlayer,
};

function restore() {
  MapLoader.loadMap = originals.map;
  MonsterLoader.spawnMonsters = originals.monsters;
  NpcLoader.loadNpcsFromTiled = originals.npcs;
  PlayerLoader.loadOrCreatePlayer = originals.player;
}

function stubPlayer() {
  PlayerLoader.loadOrCreatePlayer = async (name, spawn = { x: 2, y: 2 }) =>
    new Player("test-world-factory", name, spawn.x, spawn.y);
}

test("invalid Tiled map falls back to a fresh procedural world", async () => {
  stubPlayer();
  MapLoader.loadMap = (world) => {
    world.generateMap(8, 8);
    throw new Error("Tiled file invalid");
  };
  try {
    const { world, player } = await createWorldAndPlayer("Tester");
    assert.equal(world.width, 20);
    assert.equal(world.height, 10);
    assert.equal(world.tiles.size, 200);
    assert.equal(world.getTile(7, 7)?.walkable, true);
    assert.equal(world.players.length, 1);
    assert.equal(player.position.x, 2);
  } finally { restore(); }
});

test("monster loader failure propagates instead of hiding behind procedural fallback", async () => {
  let playerLoaded = false;
  PlayerLoader.loadOrCreatePlayer = async () => {
    playerLoaded = true;
    return new Player("unused", "Tester", 2, 2);
  };
  MapLoader.loadMap = (world) => {
    world.generateMap(8, 8);
    return { monsters: [{ x: 3, y: 2, monsterId: "test-monster" }], npcs: [] };
  };
  MonsterLoader.spawnMonsters = () => { throw new Error("monster-loader-failure"); };
  try {
    await assert.rejects(createWorldAndPlayer("Tester"), /monster-loader-failure/);
    assert.equal(playerLoaded, false);
  } finally { restore(); }
});

test("NPC loader failure propagates instead of using fallback", async () => {
  stubPlayer();
  MapLoader.loadMap = (world) => {
    world.generateMap(8, 8);
    return { monsters: [], npcs: [{ x: 3, y: 2, npcId: "test-npc" }] };
  };
  NpcLoader.loadNpcsFromTiled = () => { throw new Error("npc-loader-failure"); };
  try {
    await assert.rejects(createWorldAndPlayer("Tester"), /npc-loader-failure/);
  } finally { restore(); }
});

test("successful Tiled map preserves its spawn and entity loader results", async () => {
  stubPlayer();
  const calls: string[] = [];
  MapLoader.loadMap = (world) => {
    world.generateMap(8, 8);
    return {
      playerSpawn: { x: 1, y: 3 },
      monsters: [{ x: 3, y: 2, monsterId: "rat" }],
      npcs: [{ x: 4, y: 2, npcId: "merchant" }],
    };
  };
  MonsterLoader.spawnMonsters = () => { calls.push("monster"); };
  NpcLoader.loadNpcsFromTiled = () => { calls.push("npc"); };
  try {
    const { world, player } = await createWorldAndPlayer("Tester");
    assert.equal(world.width, 8);
    assert.equal(world.height, 8);
    assert.deepEqual(calls, ["monster", "npc"]);
    assert.deepEqual(player.position, { x: 1, y: 3 });
  } finally { restore(); }
});

test("modo autenticado inicia mapa e NPCs sem criar/salvar jogador legado", async () => {
  let loadCount = 0;
  PlayerLoader.loadOrCreatePlayer = async () => {
    loadCount++;
    throw new Error("Não deve carregar o personagem sem login");
  };
  MapLoader.loadMap = (world) => {
    world.generateMap(8, 8);
    return { playerSpawn: { x: 2, y: 2 }, monsters: [], npcs: [] };
  };
  try {
    const { world, player } = await createWorldAndPlayer("Legacy", { skipBootstrapPlayer: true });
    assert.equal(world.players.length, 0);
    assert.equal(player, undefined);
    assert.equal(loadCount, 0);
    assert.deepEqual(world.playerRespawn, { x: 2, y: 2 });
  } finally { restore(); }
});
