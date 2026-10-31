/** C1 — água e paredes definidas pelo Tiled; Node autoritativo. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { Player } from "../src/game/entities/player";
import { MovementSystem } from "../src/game/systems/movementSystem";
import { World } from "../src/game/world/World";
import { readFileSync } from "node:fs";

const sourceMap = join(process.cwd(), "..", "assets", "maps", "test-map.json");
const clientMap = join(process.cwd(), "..", "Client", "Assets", "Resources", "Maps", "test-map.json");

test("C1: mapa real marca toda água/parede visual na Collision Tiled (Node = Unity)", () => {
  const source = JSON.parse(readFileSync(sourceMap, "utf8"));
  const client = JSON.parse(readFileSync(clientMap, "utf8"));
  assert.deepEqual(source, client, "O mapa Unity deve ser exatamente o mapa autoritativo.");
  const visual = source.layers.filter((l: {name: string}) => l.name === "Ground" || l.name === "Decoration");
  const collision = source.layers.find((l: {name: string}) => l.name === "Collision")?.data as number[];
  assert.ok(Array.isArray(collision) && collision.length === source.width * source.height);
  const impassableRanges: Array<[number, number]> = source.tilesets
    .filter((s: {name: string}) => /water|wall/i.test(s.name))
    .map((s: {firstgid: number; tilecount: number}) =>
      [s.firstgid, s.firstgid + s.tilecount - 1]);
  const impassable = (gid: number) => impassableRanges.some(([lo,hi]) => gid >= lo && gid <= hi);
  for (let i = 0; i < collision.length; i++) {
    if (visual.some((l: {data: number[]}) => impassable(l.data[i])))
      assert.notEqual(collision[i], 0, "Falta Collision em x=" + (i % source.width) + ", yTiled=" + Math.floor(i / source.width));
  }
  assert.equal(collision.filter(Boolean).length, 264, "Mapa de teste atual tem 264 águas e nenhuma parede.");
});

test("C1: MapLoader bloqueia os 264 tiles de água e deixa interior caminhável", () => {
  const world = new World();
  const result = MapLoader.loadMap(world, sourceMap);
  assert.deepEqual(result.playerSpawn, { x: 15, y: 16 }, "Tiled PlayerSpawn deve corresponder ao Y visual após conversão.");
  assert.equal(world.tiles.size, 600);
  assert.equal([...world.tiles.values()].filter(tile => !tile.walkable).length, 264);
  assert.equal(world.getTile(2, 3)?.walkable, false, "Água à esquerda bloqueada");
  assert.equal(world.getTile(3, 3)?.walkable, true, "Chão interno liberado");
  assert.equal(world.getTile(15, 19)?.walkable, false, "Faixa superior de água bloqueada");
  assert.equal(world.getTile(15, 0)?.walkable, false, "Faixa inferior de água bloqueada");
  const player = new Player("water-player", "WaterTester", 3, 3);
  world.addPlayer(player);
  assert.equal(MovementSystem.moveDirection(player, world, "west", 1000), "blocked");
  assert.deepEqual(player.position, {x:3,y:3});
  assert.equal(MovementSystem.moveDirection(player, world, "east", 1000), "moved");
  assert.deepEqual(player.position, {x:4,y:3});
});

test("C1: parede e água assimétricas usam linha invertida igual ao Ground e proíbem diagonal", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-tiled-collision-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "map.json");
  const ground = Array(25).fill(6);
  const decoration = Array(25).fill(0);
  const collision = Array(25).fill(0);
  decoration[1 * 5 + 2] = 31; // parede desenhada em x2, linha Tiled 1 -> World y3
  ground[2 * 5 + 3] = 36; // água em x3, linha Tiled 2 -> World y2
  collision[1 * 5 + 2] = 31;
  collision[2 * 5 + 3] = 36;
  writeFileSync(path, JSON.stringify({
    width:5,height:5,tilewidth:32,tileheight:32,
    layers:[
      {name:"Ground",type:"tilelayer",width:5,height:5,data:ground},
      {name:"Decoration",type:"tilelayer",width:5,height:5,data:decoration},
      {name:"Collision",type:"tilelayer",width:5,height:5,data:collision},
    ],
  }));
  const world = new World();
  MapLoader.loadMap(world, path);
  assert.equal(world.getTile(2,3)?.walkable,false,"Parede na mesma posição visual");
  assert.equal(world.getTile(2,1)?.walkable,true,"Não espelhar parede no lado oposto");
  assert.equal(world.getTile(3,2)?.walkable,false,"Água na posição visual");
  assert.equal(world.getTile(3,3)?.walkable,true);

  const wall = new Player("wall","Tester",1,3);
  assert.equal(MovementSystem.moveDirection(wall,world,"east",1000),"blocked");
  assert.deepEqual(wall.position,{x:1,y:3});

  const diagonal = new Player("diagonal","Tester",1,2);
  assert.equal(MovementSystem.moveDirection(diagonal,world,"northeast",1000),"blocked",
    "Não atravessar o canto bloqueado pela parede");
  assert.deepEqual(diagonal.position,{x:1,y:2});

  const water = new Player("water","Tester",3,1);
  assert.equal(MovementSystem.moveDirection(water,world,"north",1000),"blocked");
  assert.deepEqual(water.position,{x:3,y:1});
});


test("C1: quatro bordas completas - agua e ultimo chao sem lacunas", () => {
  const world = new World();
  MapLoader.loadMap(world, sourceMap);
  // Todos os eixos, não apenas uma amostra central.
  for (let y = 3; y <= 16; y++) {
    assert.equal(world.getTile(2, y)?.walkable, false, "água na esquerda y=" + y);
    assert.equal(world.getTile(3, y)?.walkable, true, "último chão à esquerda y=" + y);
    assert.equal(world.getTile(26, y)?.walkable, true, "último chão à direita y=" + y);
    assert.equal(world.getTile(27, y)?.walkable, false, "água na direita y=" + y);
  }
  for (let x = 3; x <= 26; x++) {
    assert.equal(world.getTile(x, 2)?.walkable, false, "água embaixo x=" + x);
    assert.equal(world.getTile(x, 3)?.walkable, true, "último chão embaixo x=" + x);
    assert.equal(world.getTile(x, 16)?.walkable, true, "último chão em cima x=" + x);
    assert.equal(world.getTile(x, 17)?.walkable, false, "água em cima x=" + x);
  }
});
