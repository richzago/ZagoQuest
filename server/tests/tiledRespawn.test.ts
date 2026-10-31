/** Respawn is derived from server-loaded Tiled metadata, not a fixed (0,0). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import type { PlayerDeathEventData } from "../src/shared/interfaces/eventData.interface";

function setup() {
  const world = new World();
  world.generateMap(18, 18);
  const player = new Player("test-player", "Player", 8, 8);
  world.addPlayer(player);
  return {world, player};
}

test("player resurrects on World point read from Tiled and death is emitted once", () => {
  const {world,player}=setup();
  world.playerRespawn={x:12,y:9};
  const seen:PlayerDeathEventData[]=[];
  const onDeath=(data:PlayerDeathEventData)=>seen.push(data);
  EventSystem.getInstance().on(GameEvent.PLAYER_DEATH,onDeath);
  try{
    player.hp=0;
    DeathSystem.handleDeath(player,undefined,world);
    assert.deepEqual(player.position,{x:12,y:9});
    assert.equal(player.hp,player.maxHp);
    assert.equal(seen.length,1);
  }finally{EventSystem.getInstance().off(GameEvent.PLAYER_DEATH,onDeath)}
});

test("occupied Tiled spawn uses adjacent walkable tile, not overlapping an NPC", () => {
  const {world,player}=setup();
  world.playerRespawn={x:12,y:9};
  const blocker=new Player("other","Other",12,9);
  world.addPlayer(blocker);
  player.hp=0;
  DeathSystem.handleDeath(player,undefined,world);
  assert.notDeepEqual(player.position,{x:12,y:9});
  assert.equal(Math.abs(player.position.x-12)+Math.abs(player.position.y-9),1);
  assert.equal(world.isPositionWalkable(player.position.x,player.position.y,player.id),true);
});

test("optional RespawnSpawn Tiled object overrides PlayerSpawn and validates collision", (t) => {
  const dir=mkdtempSync(join(tmpdir(),"zago-respawn-"));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,"map.json");
  const collision=Array(100).fill(0);
  const base={
    width:10,height:10,tilewidth:32,tileheight:32,
    layers:[
      {name:"Collision",type:"tilelayer",width:10,height:10,data:collision},
      {name:"PlayerSpawn",type:"objectgroup",
        objects:[{id:1,name:"player",x:64,y:64,width:0,height:0}]},
      {name:"RespawnSpawn",type:"objectgroup",
        objects:[{id:2,name:"respawn",x:192,y:160,width:0,height:0}]},
    ],
  };
  writeFileSync(path,JSON.stringify(base));
  const res=MapLoader.loadMap(new World(),path);
  assert.deepEqual(res.playerSpawn,{x:2,y:7});
  assert.deepEqual(res.respawnSpawn,{x:6,y:4});
  // World y=4 corresponde à linha Tiled 5 (origem do Tiled fica no topo).
  collision[(10-1-4)*10+6]=1;
  writeFileSync(path,JSON.stringify(base));
  const blocked=MapLoader.loadMap(new World(),path);
  assert.equal(blocked.respawnSpawn,undefined);
});

test("real map's PlayerSpawn is (15,16) when no RespawnSpawn layer exists", () => {
  const world=new World();
  const file=join(process.cwd(),"..","assets","maps","test-map.json");
  const result=MapLoader.loadMap(world,file);
  assert.deepEqual(result.playerSpawn,{x:15,y:16});
  assert.equal(result.respawnSpawn,undefined);
});
