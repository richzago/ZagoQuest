import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { PlayerLoader } from "../src/game/loaders/playerLoader";
import { DatabasePersistence } from "../src/game/systems/databasePersistence";
import { GuildService } from "../src/api/services/guildService";
import { findSafePlayerPosition } from "../src/game/world/playerPosition";

const spawn={x:2,y:2};
function createWorld() {
  const w=new World();w.generateMap(16,16);return w;
}
function mockPersistence(t: import("node:test").TestContext, loaded:Player|null) {
  const saves: Array<{x:number,y:number}>=[];
  t.mock.method(DatabasePersistence,"loadCharacter",async()=>loaded);
  t.mock.method(DatabasePersistence,"saveCharacter",async(p:Player)=>{
    saves.push({...p.position});
  });
  t.mock.method(GuildService,"updateLastSeen",async()=>{});
  return saves;
}

test("restart restores character from PostgreSQL posX/posY rather than PlayerSpawn",async(t)=>{
  const loaded=new Player("existing","Richard",9,7);
  loaded.gold=42;
  const saves=mockPersistence(t,loaded);
  const world=createWorld();
  const player=await PlayerLoader.loadOrCreatePlayer("Richard",spawn,world);
  assert.equal(player,loaded);
  assert.deepEqual(player.position,{x:9,y:7});
  assert.equal(player.gold,42);
  assert.deepEqual(saves,[],"boot must not overwrite a valid saved position");
});

test("a blocked saved tile falls back to Tiled spawn and saves correction once",async(t)=>{
  const world=createWorld();const loaded=new Player("existing","Richard",9,7);
  world.getTile(9,7)!.walkable=false;
  const saves=mockPersistence(t,loaded);
  const player=await PlayerLoader.loadOrCreatePlayer("Richard",spawn,world);
  assert.deepEqual(player.position,spawn);
  assert.deepEqual(saves,[spawn]);
});

test("out-of-map, fractional and occupied saved tiles use safe map spawn",async(t)=>{
  for(const saved of [{x:-1,y:1},{x:2.5,y:5},{x:100,y:100},{x:6,y:6}]){
    const world=createWorld();
    if(saved.x===6)world.addPlayer(new Player("other","Other",6,6));
    const loaded=new Player("existing","Richard",saved.x,saved.y);
    const saves=mockPersistence(t,loaded);
    const player=await PlayerLoader.loadOrCreatePlayer("Richard",spawn,world);
    assert.deepEqual(player.position,spawn);
    assert.deepEqual(saves,[spawn]);
    t.mock.reset();
  }
});

test("new character starts from Tiled, choosing nearby walkable tile if occupied",async(t)=>{
  const world=createWorld();world.addPlayer(new Player("other","Other",2,2));
  const saves=mockPersistence(t,null);
  const player=await PlayerLoader.loadOrCreatePlayer("New",spawn,world);
  assert.equal(player.name,"New");
  assert.equal(player.position.x===2&&player.position.y===2,false);
  assert.equal(world.isPositionWalkable(player.position.x,player.position.y),true);
  assert.deepEqual(saves,[player.position]);
});

test("no valid spawn raises an error instead of persisting a blocked location",()=>{
  const world=createWorld();
  for(const tile of world.tiles.values())tile.walkable=false;
  assert.throws(()=>findSafePlayerPosition(world,spawn),/Nenhum tile caminhável/);
});
