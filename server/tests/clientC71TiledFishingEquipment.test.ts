/**
 * C7.1 — teste real: tiles Tiled, borda inferior e requisito de equipamentos.
 * Sem inventar água por coordenada Y nem confiar em animações do Unity.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { World } from "../src/game/world/World";
import { MapLoader } from "../src/game/loaders/mapLoader";
import { Player } from "../src/game/entities/player";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { FishingSystem } from "../src/game/systems/fishingSystem";

const mapFile = join(process.cwd(),"..","assets","maps","test-map.json");
const itemDir = join(process.cwd(),"src","data","items");
const rod = "fishing/rods/basic_rod";
const worm = "fishing/baits/worm";
const cricket = "fishing/baits/cricket";

test("C7.1: Tiled Water1 vira water apenas nos GIDs 36–75, incluindo borda inferior",()=>{
 const map = JSON.parse(readFileSync(mapFile,"utf8"));
 const world = new World();
 MapLoader.loadMap(world,mapFile);
 assert.deepEqual(map.tilesets.filter((x:{name:string})=>x.name==="Water1")
  .map((x:{firstgid:number;tilecount:number})=>[x.firstgid,x.tilecount]),[[36,40]]);
 assert.equal([...world.tiles.values()].filter(t=>t.isWater).length,264);
 for(const y of [0,1,2,17,18,19])
  assert.equal(world.getTile(15,y)?.isWater,true,"borda de água y="+y);
 for(const x of [0,1,2,27,28,29])
  assert.equal(world.getTile(x,9)?.isWater,true,"borda de água x="+x);
 assert.equal(world.getTile(15,9)?.isWater,false);
 assert.equal(world.getTile(15,3)?.walkable,true);
 assert.equal(world.getTile(15,2)?.walkable,false);
 assert.equal(world.getTile(15,2)?.isWater,true);
});

test("C7.1: só tiles vizinhos reais habilitam pesca, em todas as bordas",()=>{
 const world = new World();
 MapLoader.loadMap(world,mapFile);
 for(const [x,y] of [[15,3],[15,16],[3,9],[26,9],[3,3],[26,16]]){
  const player=new Player("test-"+x+"-"+y,"Fisher",x,y);
  assert.equal(FishingSystem.isNearWater(player,world),true,
    "terra adjacente a água em "+x+","+y);
 }
 for(const [x,y] of [[15,9],[10,12],[18,8],[9,4]]){
  const player=new Player("far-"+x+"-"+y,"Far",x,y);
  assert.equal(FishingSystem.isNearWater(player,world),false,
    "terra longe da água em "+x+","+y);
 }
 const out = new Player("out","Outside",-1,0);
 assert.equal(FishingSystem.isNearWater(out,world),false);
});

test("C7.1: vara e worm devem equipar nos slots corretos via player.equipItem",()=>{
 ItemRegistry.loadAll(itemDir);
 const p = new Player("fisher-equip","Angler",15,3);
 p.inventory.set(rod,1);
 p.inventory.set(worm,3);
 const rodItem=ItemRegistry.get(rod), wormItem=ItemRegistry.get(worm),
  cricketItem=ItemRegistry.get(cricket);
 assert.equal(rodItem.type,"equipment");
 assert.equal(rodItem.slot,EquipmentSlot.WEAPON);
 assert.equal(wormItem.type,"equipment");
 assert.equal(wormItem.slot,EquipmentSlot.USEFUL);
 assert.equal(cricketItem.type,"equipment");
 assert.equal(cricketItem.slot,EquipmentSlot.USEFUL);
 assert.ok((cricketItem.fishingBonus??0)>(wormItem.fishingBonus??0));
 assert.equal(p.equipItem(rod),true);
 assert.equal(p.equipItem(worm),true);
 assert.equal(p.equipment.get(EquipmentSlot.WEAPON),rod);
 assert.equal(p.equipment.get(EquipmentSlot.USEFUL),worm);
 assert.equal(p.inventory.get(worm),2);
});

test("C7.1: não consumir worm se não houver água mesmo com equipamentos",()=>{
 ItemRegistry.loadAll(itemDir);
 const world=new World();
 MapLoader.loadMap(world,mapFile);
 const p=new Player("mid","Angler",15,9);
 p.equipment.set(EquipmentSlot.WEAPON,rod);
 p.equipment.set(EquipmentSlot.USEFUL,worm);
 p.inventory.set(worm,3);
 assert.equal(FishingSystem.startFishing(p,world),false);
 assert.equal(p.inventory.get(worm),3);
 assert.equal(p.equipment.get(EquipmentSlot.USEFUL),worm);
 assert.equal(p.isFishing,false);
});

test("C7.1: três worms equipados/na mochila permitem 3 tentativas; a última libera Useful",(t)=>{
 t.mock.timers.enable({apis:["setTimeout"]});
 ItemRegistry.loadAll(itemDir);
 const world=new World();
 MapLoader.loadMap(world,mapFile);
 const p=new Player("near","Angler",15,3);
 p.inventory.set(rod,1);p.inventory.set(worm,3);
 assert.equal(p.equipItem(rod),true);
 assert.equal(p.equipItem(worm),true); // 2 na mochila, 1 no slot
 for(const remaining of [1,0]){
  assert.equal(FishingSystem.startFishing(p,world),true);
  assert.equal(p.inventory.get(worm)??0,remaining);
  assert.equal(p.equipment.get(EquipmentSlot.USEFUL),worm);
  FishingSystem.cancelFishing(p);
 }
 assert.equal(FishingSystem.startFishing(p,world),true);
 assert.equal(p.equipment.has(EquipmentSlot.USEFUL),false);
 assert.equal(p.equipment.get(EquipmentSlot.WEAPON),rod);
 FishingSystem.cancelFishing(p);
 assert.equal(FishingSystem.startFishing(p,world),false);
 assert.equal(p.inventory.has(worm),false);
});

test("C7.1: map fallback procedural não ganha água nem pesca artificial",()=>{
 const world=new World();
 world.generateMap(25,25);
 const player=new Player("fallback","Angler",12,16);
 assert.equal([...world.tiles.values()].filter(t=>t.isWater).length,0);
 assert.equal(FishingSystem.isNearWater(player,world),false);
});
