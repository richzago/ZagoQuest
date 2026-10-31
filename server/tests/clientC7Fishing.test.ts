/** C7 — fluxos reais do handler de pesca, com relógio virtual Node. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebSocket } from "ws";
import { WebSocket as Socket } from "ws";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { FishingSystem } from "../src/game/systems/fishingSystem";
import { handleStartFishing, handleCancelFishing } from "../src/network/handlers/fishing.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { parseClientMessage } from "../src/network/validation/messageValidation";

const rodId = "fishing/rods/basic_rod";
function setup() {
  const player = new Player("fisher", "Angler", 3, 8);
  const world = new World();
  world.generateMap(12, 12);
  const messages: Array<Record<string, unknown>> = [];
  let inventories = 0, stats = 0;
  const ws = {
    readyState: Socket.OPEN,
    send: (data: string) => messages.push(JSON.parse(data) as Record<string, unknown>),
  } as unknown as WebSocket;
  const ctx = {
    world,
    packetSender: { inventory: {
      sendInventory: () => inventories++,
      sendPlayerStats: () => stats++,
    }},
  } as unknown as HandlerContext;
  player.addItem(rodId, 1);
  return { player, world, ws, ctx, messages,
    get inventories() { return inventories; },
    get stats() { return stats; },
  };
}

test("C7: comandos de pesca são estritos e não aceitam tempo/recompensa do cliente", () => {
  for (const type of ["startFishing", "cancelFishing"] as const) {
    assert.equal(parseClientMessage(JSON.stringify({type})).ok, true);
    for (const injected of [{durationMs:1},{itemId:"currency/platinum_coin"},
      {playerId:"outro"},{x:100,y:100},{bait:"free"}])
      assert.equal(parseClientMessage(JSON.stringify({type,...injected})).ok, false);
  }
});

test("C7: iniciar, não iniciar duas vezes e concluir no tempo do Node", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  t.mock.method(ItemRegistry,"get", (id:string)=>{
    if(id===rodId) return {id,name:"Test rod",fishingTime:100,
      fishingBonus:0} as ReturnType<typeof ItemRegistry.get>;
    throw new Error("Item inesperado: "+id);
  });
  t.mock.method(Math,"random",()=>0.1);
  const f = setup();
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  assert.equal(f.player.isFishing,true);
  assert.deepEqual(f.messages.map(x=>x.state),["started"]);
  assert.equal(f.messages[0].durationMs,100);
  assert.equal(f.inventories,1);
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  assert.deepEqual(f.messages.map(x=>x.state),["started","rejected"]);
  t.mock.timers.tick(99);
  assert.equal(f.player.isFishing,true);
  assert.equal(f.messages.some(x=>x.state==="completed"),false);
  t.mock.timers.tick(1);
  assert.equal(f.player.isFishing,false);
  assert.equal(FishingSystem.durationMs(f.player),0);
  assert.equal(f.messages.at(-1)?.state,"completed");
  assert.equal(f.inventories,2);
  assert.equal(f.stats,1);
});

test("C7: cancelamento encerra timer e não entrega recompensa depois", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  t.mock.method(ItemRegistry,"get",(id:string)=>{
    if(id===rodId) return {id,name:"Test rod",fishingTime:100,
      fishingBonus:0} as ReturnType<typeof ItemRegistry.get>;
    throw new Error("ID inesperado "+id);
  });
  const f=setup();
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  handleCancelFishing(f.ws,f.player,{type:"cancelFishing"},f.ctx);
  assert.deepEqual(f.messages.map(x=>x.state),["started","cancelled"]);
  assert.equal(f.player.isFishing,false);
  assert.equal(FishingSystem.durationMs(f.player),0);
  t.mock.timers.tick(1000);
  assert.equal(f.messages.length,2);
  assert.equal(f.inventories,1);
  assert.equal(f.stats,0);
  handleCancelFishing(f.ws,f.player,{type:"cancelFishing"},f.ctx);
  assert.equal(f.messages.at(-1)?.state,"rejected");
});

test("C7: sem vara ou longe da água a pesca recusa, sem inventário falso", () => {
  const f=setup();
  f.player.inventory.clear();
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  assert.equal(f.messages.at(-1)?.state,"rejected");
  assert.equal(f.inventories,0);
  f.player.addItem(rodId,1);
  f.player.position={x:3,y:2};
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  assert.equal(f.messages.at(-1)?.state,"rejected");
  assert.equal(f.player.isFishing,false);
  assert.equal(f.inventories,0);
});

test("C7: ao desconectar não envia pacote tardio nem reabre pesca", (t) => {
  t.mock.timers.enable({apis:["setTimeout"]});
  t.mock.method(ItemRegistry,"get",(id:string)=>{
    if(id===rodId) return {id,name:"Test rod",fishingTime:100,
      fishingBonus:0} as ReturnType<typeof ItemRegistry.get>;
    throw new Error("Item inesperado "+id);
  });
  const f=setup();
  handleStartFishing(f.ws,f.player,{type:"startFishing"},f.ctx);
  (f.ws as unknown as {readyState:number}).readyState=Socket.CLOSED;
  FishingSystem.cancelFishing(f.player);
  t.mock.timers.tick(1000);
  assert.deepEqual(f.messages.map(x=>x.state),["started"]);
  assert.equal(f.inventories,1);
  assert.equal(f.player.isFishing,false);
});
