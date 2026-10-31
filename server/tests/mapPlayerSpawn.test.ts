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
  assert.deepEqual(result.playerSpawn, { x: 15, y: 16 });
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
    assert.deepEqual(result.playerSpawn, { x: 2, y: 6 }, JSON.stringify(object));
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


test("C1: objetos do mapa real usam a mesma orientação de Ground e Collision", () => {
  const world = new World();
  const file = join(process.cwd(), "..", "assets", "maps", "test-map.json");
  const {playerSpawn, monsters, npcs} = MapLoader.loadMap(world, file);

  // O Tiled define posições em pixels, com a linha 0 NO TOPO.
  // O Node/Unity usam Y crescente para cima, como DrawLayer e Collision.
  assert.deepEqual(playerSpawn, {x:15,y:16});
  assert.deepEqual(monsters.map(({x,y,monsterId})=>({x,y,monsterId})),
    [{x:4,y:5,monsterId:"goblin"}]);
  assert.deepEqual(npcs?.map(({x,y,npcId,objectId})=>({x,y,npcId,objectId})), [
    {x:25,y:13,npcId:"banker",objectId:3},
    {x:25,y:5,npcId:"merchant",objectId:4},
  ]);
  for (const pos of [playerSpawn!, ...monsters, ...(npcs||[])])
    assert.equal(world.getTile(pos.x,pos.y)?.walkable,true,
      "Objeto deveria estar sobre chão e não sobre água: "+JSON.stringify(pos));
});

test("C1: spawns assimétricos respeitam o topo do Tiled em um mapa sintético", (t) => {
  const dir=mkdtempSync(join(tmpdir(),"zago-c1-spawn-y-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,"map.json");
  const point=(id:number,name:string,x:number,y:number,properties:any[] = [])=>({
    id,name,type:"",x:x*32,y:y*32,width:0,height:0,properties,
  });
  const collision=Array(100).fill(0);
  collision[1*10+7]=31; // linha Tiled 1, world y=8
  writeFileSync(file,JSON.stringify({width:10,height:10,tilewidth:32,tileheight:32,
    layers:[
      {name:"Collision",type:"tilelayer",width:10,height:10,data:collision},
      {name:"PlayerSpawn",type:"objectgroup",objects:[point(1,"player",2,1)]},
      {name:"RespawnSpawn",type:"objectgroup",objects:[point(2,"respawn",3,5)]},
      {name:"MonsterSpawn",type:"objectgroup",objects:[
        point(3,"goblin",4,8,[{name:"monsterId",value:"goblin",type:"string"}])
      ]},
      {name:"NPCSpawn",type:"objectgroup",objects:[
        point(4,"banker",7,1,[{name:"npcId",value:"banker",type:"string"}])
      ]},
    ],
  }));
  const world=new World();
  const result=MapLoader.loadMap(world,file);
  assert.deepEqual(result.playerSpawn,{x:2,y:8});
  assert.deepEqual(result.respawnSpawn,{x:3,y:4});
  assert.deepEqual(result.monsters.map(({x,y})=>({x,y})),[{x:4,y:1}]);
  assert.deepEqual(result.npcs?.map(({x,y})=>({x,y})),[{x:7,y:8}]);
  assert.equal(world.getTile(7,8)?.walkable,false,
    "A camada Collision também usa Tiled row=1 => World y=8.");
});
