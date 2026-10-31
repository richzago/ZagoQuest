/** Monster XP is a conserved shared pool proportional to actual damage. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { CombatFormula } from "../src/game/systems/combatFormula";
import { CombatSystem } from "../src/game/combat/combatSystem";
import { ExperienceSystem } from "../src/game/systems/experienceSystem";
import { DeathSystem } from "../src/game/systems/deathSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
const type: MonsterType = {
  id:"xp-share-dummy", name:"Dummy",level:1, stats:{hp:20},
  combat:{xp:25,damageMin:1,damageMax:2},
  ai:{type:"passive"}, loot:[], visual:{symbol:"D"},
};
function fixture() {
  const world = new World(); world.generateMap(20,20);
  const players = ["a","b","c"].map((id,i)=>new Player(id,id,2,3+i));
  for(const p of players)world.addPlayer(p);
  const monster = new Monster("target",type,3,3,new MonsterAI(),3,60000);
  world.addMonster(monster);
  return {world,players,monster};
}

test("damage-weighted rounding conserves a pool including ties", () => {
  assert.deepEqual([...ExperienceSystem.splitXpByDamage(25,
    new Map([["a",5],["b",3],["c",2]]))], [["a",13],["b",7],["c",5]]);
  const split = ExperienceSystem.splitXpByDamage(1,
    new Map([["b",1],["a",1]]));
  assert.equal([...split.values()].reduce((x,y)=>x+y,0),1);
  assert.equal(split.get("a"),1); // tie -> stable id
});

test("higher actual damage gets higher XP, last hit no longer receives it all", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const {world,players:[a,b],monster}=fixture();
  const rolls=[15,5];
  t.mock.method(CombatFormula,"calculateDamage",()=>({
    damage: rolls.shift() ?? 1, isCritical:false,
  }));
  try {
    assert.equal(CombatSystem.attack(a,monster,world),15);
    assert.equal(CombatSystem.attack(b,monster,world),5);
    assert.equal(a.experience,19);
    assert.equal(b.experience,6);
    assert.equal(monster.damageByPlayer.get(a.id),15);
    assert.equal(monster.damageByPlayer.get(b.id),5);
    assert.equal(monster.deathProcessed,true);
  } finally {DeathSystem.cancelPendingTimers(world)}
});

test("three attackers get proportional integer rewards; corpse still last-hit", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const {world,players:[a,b,c],monster}=fixture();
  try {
    monster.recordPlayerDamage(a.id,10);
    monster.recordPlayerDamage(b.id,6);
    monster.recordPlayerDamage(c.id,4);
    monster.hp=0;
    DeathSystem.handleDeath(monster,c,world);
    assert.deepEqual([a.experience,b.experience,c.experience],[13,7,5]);
    assert.equal(world.corpses[0].killerId,c.id);
    assert.equal(monster.deathProcessed,true);
    DeathSystem.handleDeath(monster,c,world);
    assert.equal(world.corpses.length,1);
    assert.deepEqual([a.experience,b.experience,c.experience],[13,7,5]);
  }finally{DeathSystem.cancelPendingTimers(world)}
});

test("periodic damage is counted and overkill is clamped to remaining HP", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const {world,players:[a,b],monster}=fixture();
  try {
    assert.equal(CombatSystem.applyPeriodicDamage(monster,15,world,a,"Poison"),15);
    assert.equal(monster.damageByPlayer.get(a.id),15);
    assert.equal(CombatSystem.applyPeriodicDamage(monster,100,world,b,"Burn"),5);
    assert.equal(monster.damageByPlayer.get(b.id),5);
    assert.equal(a.experience,19);
    assert.equal(b.experience,6);
    assert.equal(world.corpses.length,1);
    assert.equal(CombatSystem.applyPeriodicDamage(monster,10,world,a,"Poison"),0);
  }finally{DeathSystem.cancelPendingTimers(world)}
});

test("stale or non-positive contributors never create XP", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  const {world,players:[a,b],monster}=fixture();
  try {
    monster.recordPlayerDamage(a.id,20);
    monster.recordPlayerDamage(b.id,0);
    monster.recordPlayerDamage("not-connected",100);
    monster.hp=0;
    DeathSystem.handleDeath(monster,b,world);
    assert.equal(a.experience,25);
    assert.equal(b.experience,0);
  }finally{DeathSystem.cancelPendingTimers(world)}
});
