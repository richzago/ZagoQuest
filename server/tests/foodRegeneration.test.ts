/**
 * C6 food: testes de domínio reais (não testes de screenshot / contrato C#).
 * Relógio injetado evita timers e esperas; Node sempre controla regeneração.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import type { WebSocket } from "ws";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { Player } from "../src/game/entities/player";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { handleUseItem } from "../src/network/handlers/inventory.handler";
import {
 FoodRegenerationSystem, FOOD_HP_PER_TICK, FOOD_MANA_PER_TICK,
 FOOD_TICK_MS, MAX_FOOD_SECONDS,
} from "../src/game/systems/foodRegenerationSystem";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";

function player() { return new Player("food-test", "Comedor", 2, 2); }
const ws = {} as WebSocket;

test("food: recupera vida e mana apenas a cada 2 segundos, sem exceder max",()=>{
 const p=player();
 p.hp=p.maxHp-3;
 p.mana=p.maxMana-2;
 const now=10_000;
 assert.equal(FoodRegenerationSystem.canEat(p, 10, now), true);
 FoodRegenerationSystem.feed(p,10,now);
 assert.equal(FoodRegenerationSystem.tick(p,now+1999),false);
 assert.equal(p.hp,p.maxHp-3);
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS),true);
 assert.equal(p.hp,p.maxHp-3+FOOD_HP_PER_TICK);
 assert.equal(p.mana,p.maxMana-2+FOOD_MANA_PER_TICK);
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS+100),false);
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS*2),true);
 assert.equal(p.hp,p.maxHp);
 assert.equal(p.mana,p.maxMana);
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS*3),false);
 assert.equal(PlayerStatsSender.toPayload(p).mana,p.maxMana);
});

test("food: mais comida estende saciedade sem ticks duplicados; cap é 120s",()=>{
 const p=player();
 const now=20_000;
 FoodRegenerationSystem.feed(p,80,now);
 assert.equal(FoodRegenerationSystem.remainingSeconds(p,now),80);
 FoodRegenerationSystem.feed(p,80,now+200);
 assert.equal(FoodRegenerationSystem.remainingSeconds(p,now+200),MAX_FOOD_SECONDS);
 assert.equal(FoodRegenerationSystem.canEat(p,30,now+200),false);
 p.mana=0;
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS),true);
 assert.equal(p.mana,FOOD_MANA_PER_TICK);
 assert.equal(FoodRegenerationSystem.tick(p,now+FOOD_TICK_MS+10),false);
});

test("food: não ressuscita jogador nem regenera depois de expirar",()=>{
 const dead=player();
 dead.hp=0;
 assert.equal(FoodRegenerationSystem.canEat(dead,30,5_000),false);
 FoodRegenerationSystem.feed(dead,10,5_000);
 assert.equal(FoodRegenerationSystem.tick(dead,8_000),false);
 assert.equal(dead.hp,0);

 const p=player(); p.hp=1; p.mana=1;
 FoodRegenerationSystem.feed(p,4,10_000);
 assert.equal(FoodRegenerationSystem.tick(p,30_000),true);
 assert.equal(p.hp,1+2*FOOD_HP_PER_TICK);
 assert.equal(p.mana,1+2*FOOD_MANA_PER_TICK);
 assert.equal(FoodRegenerationSystem.remainingSeconds(p,30_000),0);
 assert.equal(FoodRegenerationSystem.tick(p,32_000),false);
});

test("food: rejeita parâmetros inválidos e não altera mana com maxMana zero",()=>{
 const p=player();
 for(const invalid of [0,-1,1.5,NaN,Infinity,MAX_FOOD_SECONDS+1]){
  assert.equal(FoodRegenerationSystem.canEat(p,invalid),false);
 }
 p.mana=0; p.maxMana=0; p.hp=5;
 FoodRegenerationSystem.feed(p,5,50_000);
 assert.equal(FoodRegenerationSystem.tick(p,52_000),true);
 assert.equal(p.mana,0);
 assert.equal(p.hp,5+FOOD_HP_PER_TICK);
});

test("food: handler consome só uma unidade e emite snapshot ao regenerar, não ao alimentar",async()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const p=player();p.hp=p.maxHp-10;p.mana=0;
 p.addItem("consumable/cheese",2);
 const events:{used:Array<{success:boolean;message:string}>; inventory:number; stats:number}={
  used:[],inventory:0,stats:0,
 };
 const ctx={
  packetSender:{inventory:{
   sendItemUsed:(_id:string,success:boolean,message:string)=>events.used.push({success,message}),
   sendInventory:()=>events.inventory++,
   sendPlayerStats:()=>events.stats++,
  }},
 } as unknown as HandlerContext;
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/cheese"},ctx);
 assert.equal(events.used[0]?.success,true);
 assert.equal(p.inventory.get("consumable/cheese"),1);
 assert.equal(p.hp,p.maxHp-10); assert.equal(p.mana,0);
 assert.equal(events.inventory,1);assert.equal(events.stats,0);
 assert.equal(FoodRegenerationSystem.remainingSeconds(p)>0,true);
 assert.equal(FoodRegenerationSystem.canEat(p,120),false);
 // Poção mantém efeito instantâneo, sem criar status de food.
 p.addItem("consumable/health_potion",1);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/health_potion"},ctx);
 assert.equal(events.used.at(-1)?.success,true);
 assert.ok(p.hp>p.maxHp-10);
 assert.equal(events.stats,1);
});

test("food: peixes e queijo possuem tempo positivo configurado",()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 for(const id of ["consumable/cheese","fishing/fish/trout","fishing/fish/salmon",
  "fishing/fish/perch","fishing/fish/golden"]){
  const value=ItemRegistry.get(id).foodSeconds;
  assert.ok(value && value>0 && value<=MAX_FOOD_SECONDS,id);
 }
});
