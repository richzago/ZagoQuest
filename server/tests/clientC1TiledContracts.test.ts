/** C1: mapa canônico, separação das layers e sprites/GIDs.
 *  Testes estáticos Node: não compilam/validam a cena no Unity.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(process.cwd(), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("C1: mesmo Tiled JSON usado por Node e Unity", () => {
  const serverMap = read("assets/maps/test-map.json");
  const unityMap = read("Client/Assets/Resources/Maps/test-map.json");
  assert.deepEqual(JSON.parse(serverMap), JSON.parse(unityMap));
});

test("C1: dimensões, layers e GIDs coerentes no mapa 2D", () => {
  const map = JSON.parse(read("assets/maps/test-map.json"));
  assert.equal(map.width, 30);
  assert.equal(map.height, 20);
  const names = map.layers.map((layer: {name: string}) => layer.name);
  for (const name of ["Ground", "Decoration", "Collision", "PlayerSpawn", "MonsterSpawn", "NPCSpawn"])
    assert.ok(names.includes(name), "Falta layer " + name);

  const maxGid = Math.max(...map.tilesets.map((tileset: {firstgid: number; tilecount: number}) =>
    tileset.firstgid + tileset.tilecount - 1));
  for (const layer of map.layers.filter((item: {type: string}) => item.type === "tilelayer")) {
    assert.equal(layer.data.length, map.width * map.height, "Tamanho inválido: " + layer.name);
    for (const gid of layer.data) {
      assert.ok(Number.isInteger(gid) && gid >= 0 && gid <= maxGid,
        "GID inválido em " + layer.name + ": " + gid);
    }
  }
});

test("C1: Collision só alimenta a matriz; não é desenhada como layer visual", () => {
  const source = read("Client/Assets/Resources/Scripts/World/TiledMapRenderer.cs");
  assert.match(source, /l\.name == "Ground"/);
  assert.match(source, /layer\.name == "Collision" \|\| layer\.name == "Ground"/);
  assert.match(source, /l\.name == "Collision" && l\.type == "tilelayer"/);
  assert.match(source, /SetCollisionMatrix\(blocked, mapData\.width, mapData\.height\)/);
  assert.match(source, /missingGids\.Add\(gid\)/);
});
