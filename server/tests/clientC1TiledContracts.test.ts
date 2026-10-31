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

test("C1: decoração compartilha o Grid do chão e pula camadas vazias", () => {
  const source = read("Client/Assets/Resources/Scripts/World/TiledMapRenderer.cs");
  assert.match(source, /layerObj\.transform\.SetParent\(groundTilemap\.transform\.parent, false\)/);
  assert.match(source, /layerObj\.transform\.localPosition = groundTilemap\.transform\.localPosition/);
  assert.match(source, /layerObj\.transform\.localRotation = groundTilemap\.transform\.localRotation/);
  assert.match(source, /layerObj\.transform\.localScale = groundTilemap\.transform\.localScale/);
  assert.doesNotMatch(source, /layerObj\.transform\.SetParent\(this\.transform\)/);
  assert.match(source, /Array\.Exists\(layer\.data, gid => gid != 0\)/);
  assert.match(source, /if \(!HasValidTileData\(layer\)\) continue/);
  assert.match(source, /if \(!HasValidTileData\(collision\)\) return/);
  assert.match(source, /if \(!HasValidTileData\(layer\)\) return/);
});

test("C1: a cena principal associa Ground ao Grid, não ao MapManager", () => {
  const scene = read("Client/Assets/scenebasic.unity");
  assert.match(scene, /m_EditorClassIdentifier: Assembly-CSharp::TiledMapRenderer[\s\S]*?groundTilemap: \{fileID: 880854271\}/);
  assert.match(scene, /m_Name: MapManager/);
  assert.match(scene, /m_Name: Grid/);
  assert.match(scene, /m_Father: \{fileID: 1217622213\}/);
});

test("C1: Node e Unity convertem o eixo Y da Collision igual ao Ground", () => {
  const node = read("server/src/game/loaders/mapLoader.ts");
  const unity = read("Client/Assets/Resources/Scripts/World/TiledMapRenderer.cs");
  assert.match(node, /const worldY = mapData\.height - 1 - y/);
  assert.match(node, /world\.getTile\(x, worldY\)/);
  assert.match(unity, /new Vector3Int\(x, mapData\.height - 1 - y, 0\)/);
  assert.match(unity, /blocked\[x, mapData\.height - 1 - y\] = collision\.data\[idx\] != 0/);
});


test("C1: Grid -0.5 alinha sprite visual e jogador autoritativo nas quatro bordas", () => {
  // Git no runner Windows pode converter YAML LF -> CRLF.
  const scene = read("Client/Assets/scenebasic.unity").replace(/\r\n/g, "\n");
  const component = (unityType: number, id: number) => {
    const marker = "--- !u!" + unityType + " &" + id + "\n";
    const start = scene.indexOf(marker);
    assert.ok(start >= 0, "Componente ausente na cena: " + marker);
    const next = scene.indexOf("\n--- !u!", start + marker.length);
    return scene.slice(start, next >= 0 ? next : undefined);
  };
  const position = (yaml: string, prop: string) => {
    const re = new RegExp(prop + ": \\{x: (-?[\\d.]+), y: (-?[\\d.]+), z: (-?[\\d.]+)\\}");
    const values = yaml.match(re);
    assert.ok(values, "Falta " + prop);
    return {x: Number(values[1]), y: Number(values[2])};
  };

  // TileAnchor (0.5,0.5): sem offset, tile x3 fica em x3.5
  // enquanto o PlayerController posiciona o personagem em x3.
  const grid = component(4, 1217622213);
  const ground = component(4, 880854269);
  const tilemap = component(1839735485, 880854271);
  const gridOrigin = position(grid, "m_LocalPosition");
  const tileLocal = position(ground, "m_LocalPosition");
  const anchor = position(tilemap, "m_TileAnchor");
  assert.deepEqual(gridOrigin, {x:-0.5, y:-0.5});
  assert.deepEqual(tileLocal, {x:0, y:0});
  assert.deepEqual(anchor, {x:0.5, y:0.5});

  const client = read("Client/Assets/Resources/Scripts/Player/PlayerController.cs");
  assert.match(client, /transform\.position = new Vector3\(currentGridPosition\.x, currentGridPosition\.y, 0\)/);
  assert.match(client, /transform\.position = new Vector3\(confirmed\.x, confirmed\.y, 0\)/);

  const source = JSON.parse(read("assets/maps/test-map.json"));
  const groundLayer = source.layers.find((layer: {name: string}) => layer.name === "Ground");
  const collision = source.layers.find((layer: {name: string}) => layer.name === "Collision");
  assert.ok(groundLayer && collision);
  const tileId = (layer: {data: number[]}, x: number, y: number) =>
    layer.data[(source.height - 1 - y) * source.width + x];
  const visualCenter = (x: number, y: number) => ({
    x: gridOrigin.x + tileLocal.x + x + anchor.x,
    y: gridOrigin.y + tileLocal.y + y + anchor.y,
  });

  for (const [x,y] of [[3,3],[26,3],[3,16],[26,16],[15,10]]) {
    assert.deepEqual(visualCenter(x,y),{x,y}, "Centro divergente no tile "+x+","+y);
    assert.equal(tileId(collision,x,y),0,"Chão deveria ser caminhável: "+x+","+y);
    assert.ok(tileId(groundLayer,x,y)>0,"Ground ausente");
  }
  for (const [x,y] of [[2,3],[27,3],[15,2],[15,17]]) {
    assert.notEqual(tileId(collision,x,y),0,"Água deve ser bloqueada: "+x+","+y);
  }

  for (const file of [
    "Client/Assets/Resources/Tilesets/[A]Grass1-Dirt1_pipo.png.meta",
    "Client/Assets/Resources/Tilesets/player_human_01.png.meta",
  ]) {
    const asset = read(file);
    assert.match(asset, /spritePixelsToUnits: 32/);
    assert.match(asset, /spritePivot: \{x: 0\.5, y: 0\.5\}/);
  }
});
