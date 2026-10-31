/**
 * Server target selection must survive temporary loss of melee reach, while
 * server STOP acknowledgements must never echo into a new client STOP.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { PlayerAttackSystem } from "../src/game/combat/playerAttackSystem";
import { tickWorld } from "../src/game/core/gameStarter";
import { handleStopAutoAttack } from "../src/network/handlers/attack.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import type { WebSocketServer } from "../src/network/websocket/wsServer";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
const type:MonsterType={
  id:"flee-target",name:"Rat",stats:{hp:20,speed:20},
  combat:{xp:4,damageMin:1,damageMax:2},
  ai:{type:"aggressive",fleeHp:5},visual:{symbol:"R"},
};
const unity=(path:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",path),"utf8");

test("low HP target fleeing outside reach stays selected, then autoattack resumes",t=>{
  const w=new World();w.generateMap(20,20);
  const p=new Player("p","Player",3,3);
  const m=new Monster("m",type,6,3,new MonsterAI());
  m.hp=4;
  w.addPlayer(p);w.addMonster(m);
  p.currentTargetId=m.id;
  t.mock.method(m.ai,"update",()=>{}); // Freeze AI only to isolate selection lifetime
  const attacks: string[]=[];
  t.mock.method(PlayerAttackSystem,"tryAttack",(_p:Player,target:Monster|undefined)=>{
    attacks.push(target!.id);
    return {ok:true as const,damage:1};
  });
  const packets:string[]=[];
  const ws={
    broadcastMove:()=>{},
    broadcastDespawn:()=>{},
    sendToPlayer:(_id:string,payload:string)=>packets.push(payload),
  } as unknown as WebSocketServer;
  tickWorld(w,ws);
  assert.equal(p.currentTargetId,m.id);
  assert.deepEqual(attacks,[]);
  assert.equal(packets.some(payload=>payload.includes("autoAttackStopped")),false);
  m.position={x:4,y:3}; // fugitive is caught
  tickWorld(w,ws);
  assert.equal(p.currentTargetId,m.id);
  assert.deepEqual(attacks,[m.id]);
});

test("client-initiated STOP carries previous target ID for stale-ACK filtering",()=>{
  const player=new Player("p","Player",3,3);
  player.currentTargetId="previous-target";
  const replies:Array<{reason:string,id?:string}>=[];
  const ctx={
    packetSender:{combat:{sendAutoAttackStopped:(reason:string,id?:string)=>replies.push({reason,id})}},
  } as unknown as HandlerContext;
  handleStopAutoAttack({} as WebSocket,player,{type:"stopAutoAttack"},ctx);
  assert.equal(player.currentTargetId,undefined);
  assert.deepEqual(replies,[{reason:"Auto attack parado",id:"previous-target"}]);
});

test("Unity SERVER stop does not trigger outbound STOP or clear newer targets",()=>{
  const client=unity("Combat/TargetSelector.cs");
  const handler=unity("Networking/Handlers/AutoAttackStoppedHandler.cs");
  assert.match(handler,/OnServerAutoAttackStopped\(/);
  assert.doesNotMatch(handler,/context\.TargetSelector\?\.ClearTarget\(\)/);
  assert.match(client,/if \(!string\.IsNullOrEmpty\(targetId\) && targetId != currentTargetId\)/);
  assert.match(client,/ClearTargetInternal\(false\)/);
  assert.match(client,/if \(hadTarget && notifyServer &&/);
  assert.match(client,/NetworkManager\.Instance\.Combat\.SendStopAutoAttack\(\)/);
});
