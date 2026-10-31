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
import { handleUseItem, handleEquipItem } from "../src/network/handlers/inventory.handler";
import {
 FoodRegenerationSystem, FOOD_HP_PER_TICK, FOOD_MANA_PER_TICK,
 FOOD_TICK_MS, MAX_FOOD_SECONDS,
} from "../src/game/systems/foodRegenerationSystem";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";
import { InventorySender } from "../src/network/senders/inventorySender";

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
 FoodRegenerationSystem.feed(p,40,now);
 assert.equal(FoodRegenerationSystem.remainingSeconds(p,now+200),MAX_FOOD_SECONDS);
 assert.equal(FoodRegenerationSystem.canEat(p,20,now+200),false);
 assert.equal(FoodRegenerationSystem.canEat(p,20,now+90_000),false);
 assert.equal(FoodRegenerationSystem.canEat(p,20,now+120_201),true);
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
 // Food parcial pode ser prolongado; o teto é verificado noutro teste.
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


test("pocoes: canonical effect.healHp/healMana restaura no ato sem exceder máximo",async()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const p=player();
 const used:Array<{item:string;success:boolean}>=[];
 let stats=0; let inventory=0;
 const ctx={packetSender:{inventory:{
  sendItemUsed:(id:string,success:boolean)=>used.push({item:id,success}),
  sendInventory:()=>inventory++,
  sendPlayerStats:()=>stats++,
 }}} as unknown as HandlerContext;
 p.hp=p.maxHp-9;p.mana=p.maxMana-10;
 p.addItem("consumable/health_potion",1);
 p.addItem("consumable/mana_potion",1);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/health_potion"},ctx);
 assert.equal(p.hp,p.maxHp);
 assert.equal(p.mana,p.maxMana-10);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/mana_potion"},ctx);
 assert.equal(p.mana,p.maxMana);
 assert.equal(p.inventory.has("consumable/health_potion"),false);
 assert.equal(p.inventory.has("consumable/mana_potion"),false);
 assert.deepEqual(used.map(x=>x.success),[true,true]);
 assert.equal(stats,2);assert.equal(inventory,2);

 // Mesmo com mana cheia a poção pode ser gasta, sem ultrapassar o máximo.
 p.addItem("consumable/mana_potion",1);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/mana_potion"},ctx);
 assert.equal(used.at(-1)?.success,true);
 assert.equal(p.inventory.has("consumable/mana_potion"),false);
 assert.equal(p.mana,p.maxMana);
 assert.equal(inventory,3);
 assert.equal(stats,2);
});


test("C6: useItem equipa espada, mas equipItem não consome nem equipa alimento",async()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const p=player();
 p.addItem("bone_sword",1);
 p.addItem("consumable/cheese",1);
 const responses={used:[] as boolean[],errors:[] as string[],inventory:0,equipment:0,stats:0};
 const ctx={packetSender:{inventory:{
  sendItemUsed:(_id:string,success:boolean)=>responses.used.push(success),
  sendError:(message:string)=>responses.errors.push(message),
  sendInventory:()=>responses.inventory++,
  sendEquipment:()=>responses.equipment++,
  sendPlayerStats:()=>responses.stats++,
 }}} as unknown as HandlerContext;
 await handleUseItem(ws,p,{type:"useItem",itemId:"bone_sword"},ctx);
 assert.deepEqual(responses.used,[true]);
 assert.equal(p.equipment.has("weapon" as never),true);
 assert.equal(p.inventory.has("bone_sword"),false);
 assert.equal(responses.equipment,1);
 await handleEquipItem(ws,p,{type:"equipItem",itemId:"consumable/cheese"},ctx);
 assert.equal(p.inventory.get("consumable/cheese"),1);
 assert.equal(responses.errors.length,1);
 assert.equal(responses.inventory,1);
 assert.equal(responses.equipment,1);
});


test("C6 inventory snapshot informa tipo consumable/equipment e ignora item legado sem cadastro",()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const p=player();
 p.addItem("consumable/cheese",2);
 p.addItem("consumable/mana_potion",1);
 p.addItem("bone_sword",1);
 p.addItem("legacy_item_sem_definicao",1);
 const packets: Array<{type:string;items:Array<{itemId:string;amount:number;itemType?:string}>}> = [];
 const socket = { readyState: 1, send: (packet: string) => { packets.push(JSON.parse(packet)); } } as unknown as WebSocket;
 new InventorySender(socket).sendInventory(p);
 assert.equal(packets.length,1);
 assert.equal(packets[0].type,"inventory");
 const byId=new Map(packets[0].items.map(x=>[x.itemId,x]));
 assert.equal(byId.get("consumable/cheese")?.itemType,"consumable");
 assert.equal(byId.get("consumable/mana_potion")?.itemType,"consumable");
 assert.equal(byId.get("bone_sword")?.itemType,"equipment");
 assert.equal(byId.get("legacy_item_sem_definicao")?.itemType,undefined);
});


test("C6 saciedade: seis queijos ou três carnes enchem e bloqueiam até acabar",()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const cheese=ItemRegistry.get("consumable/cheese").foodSeconds!;
 const meat=ItemRegistry.get("consumable/meat").foodSeconds!;
 assert.equal(cheese,20); assert.equal(meat,40);
 const start=50000;
 for(const [duration,count] of [[cheese,6],[meat,3]]){
  const p=player();
  for(let n=0;n<count;n++){
   assert.equal(FoodRegenerationSystem.canEat(p,duration,start),true);
   FoodRegenerationSystem.feed(p,duration,start);
  }
  assert.equal(FoodRegenerationSystem.remainingSeconds(p,start),120);
  assert.equal(FoodRegenerationSystem.canEat(p,cheese,start),false);
  assert.equal(FoodRegenerationSystem.canEat(p,cheese,start+60000),false);
  assert.equal(FoodRegenerationSystem.canEat(p,cheese,start+120001),true);
 }
});

test("C6 saciedade: comida que não cabe inteira é recusada sem consumir",async()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const p=player();
 p.addItem("consumable/cheese",6);
 p.addItem("consumable/meat",1);
 const events: Array<{success:boolean;message:string}> =[];
 const ctx={packetSender:{inventory:{
  sendItemUsed:(_id:string,success:boolean,message:string)=>events.push({success,message}),
  sendInventory:()=>{},
 }}} as unknown as HandlerContext;
 for(let i=0;i<5;i++)
  await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/cheese"},ctx);
 assert.equal(p.inventory.get("consumable/cheese"),1);
 assert.equal(FoodRegenerationSystem.canEat(p,40),false);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/meat"},ctx);
 assert.equal(events.at(-1)?.success,false);
 assert.equal(p.inventory.get("consumable/meat"),1);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/cheese"},ctx);
 assert.equal(events.at(-1)?.success,true);
 assert.equal(p.inventory.has("consumable/cheese"),false);
 await handleUseItem(ws,p,{type:"useItem",itemId:"consumable/meat"},ctx);
 assert.equal(events.at(-1)?.success,false);
 assert.equal(p.inventory.get("consumable/meat"),1);
});

test("C6 saciedade: alimentos possuem durações variadas e nunca ultrapassam teto",()=>{
 ItemRegistry.loadAll(join(process.cwd(),"src/data/items"));
 const ids=["consumable/cheese","consumable/meat","fishing/fish/trout",
 "fishing/fish/salmon","fishing/fish/perch","fishing/fish/golden"];
 const values=ids.map(id=>ItemRegistry.get(id).foodSeconds);
 assert.deepEqual(values,[20,40,30,40,20,40]);
 assert.ok(values.every(x=>x && x>0 && x<=MAX_FOOD_SECONDS));
});
