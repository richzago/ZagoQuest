import assert from "node:assert/strict";
import {test} from "node:test";
import {join} from "node:path";
import {readFileSync} from "node:fs";
import {Player} from "../src/game/entities/player";
import {Npc} from "../src/game/entities/npc";
import {ShopSystem} from "../src/game/systems/shopSystem";
import {ItemRegistry} from "../src/data/items/itemRegistry";
import {EquipmentSlot} from "../src/shared/enums/equipmentSlot.enum";
const bag="equipment/backpack/simple_bag",potion="consumable/health_potion";
const root=join(process.cwd(),"src","data");
ItemRegistry.loadAll(join(root,"items"));
function setup(){
 const player=new Player("buyer","C17",2,2);
 player.gold=10000;
 const npc=new Npc("c17-shop","Merchant",2,3,"Hello","merchant");
 npc.shopItems=JSON.parse(readFileSync(join(root,"npc","merchant.json"),"utf8")).shopItems;
 assert.equal(ShopSystem.buyItem(player,npc,bag,1),true);
 return {player,npc,rootId:player.equippedBagInstanceId!};
}
function fillRoot(player:Player,npc:Npc){
 assert.equal(ShopSystem.buyItem(player,npc,bag,10),true);
 assert.equal(player.getContainerSlotsUsed(),10);
 return player.getVisibleBagChildren();
}
test("C17: compra com raiz cheia encontra Bag filha vazia, sem inventário fantasma",()=>{
 const {player,npc,rootId}=setup();
 const children=fillRoot(player,npc);
 assert.equal(children.length,10);
 const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,potion,4),true);
 assert.ok(player.gold<gold);
 assert.equal(player.inventory.has(potion),false);
 assert.equal(player.bagInstances.get(rootId)!.items.has(potion),false);
 assert.equal(player.bagInstances.get(children[0].instanceId)!.items.get(potion),4);
 assert.equal(player.lastShopNestedStorage,true);
 assert.equal(player.getViewedBagInstanceId(),rootId);
 assert.equal(player.openNestedBag(bag,children[0].instanceId),true);
 assert.equal(player.inventory.get(potion),4);
 assert.equal(player.closeNestedBag(),true);
 assert.equal(player.inventory.get(potion),undefined);
});
test("C17: compra empilha em Bag já ocupada mesmo quando não está aberta",()=>{
 const {player,npc,rootId}=setup();
 const children=fillRoot(player,npc);
 assert.equal(ShopSystem.buyItem(player,npc,potion,5),true);
 const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,potion,7),true);
 assert.ok(player.gold<gold);
 assert.equal(player.bagInstances.get(children[0].instanceId)?.items.get(potion),10);
 assert.equal(player.bagInstances.get(children[1].instanceId)?.items.get(potion),2);
 assert.equal(player.bagInstances.get(rootId)?.items.get(potion),undefined);
});
test("C17: se maxStack=10, compra de 11 potions SEM segunda Bag é recusada, sem débito",()=>{
 const {player,npc}=setup();
 assert.equal(ItemRegistry.get(potion).maxStack,10);
 const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,potion,11),false);
 assert.equal(player.gold,gold);
 assert.equal(player.inventory.has(potion),false);
});
test("C17: potions não ultrapassam maxStack quando principal lotada",()=>{
 const {player,npc}=setup();const children=fillRoot(player,npc);
 assert.equal(ShopSystem.buyItem(player,npc,potion,10),true);
 const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,potion,10),true);
 assert.ok(player.gold < gold);
 assert.equal(player.bagInstances.get(children[0].instanceId)!.items.get(potion),10);
 assert.equal(player.bagInstances.get(children[1].instanceId)!.items.get(potion),10);
});

test("C17: Bag recém-comprada dentro de outra Bag recebe UUID sem sumir ao navegar",()=>{
 const {player,npc}=setup();const children=fillRoot(player,npc);
 const a=player.bagInstances.get(children[0].instanceId)!;
 const before=a.children.length;const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,bag,1),true);
 assert.ok(player.gold<gold);
 assert.equal(a.children.length,before+1);
 const child=player.bagInstances.get(a.children.at(-1)!)!;
 assert.equal(child.itemId,bag);
 assert.deepEqual([...child.items],[]);
 assert.equal(a.items.get(bag),1);
 assert.equal(player.openNestedBag(bag,a.id),true);
 assert.equal(player.openNestedBag(bag,child.id),true);
 assert.equal(player.getViewedBagInstanceId(),child.id);
 assert.equal(player.closeNestedBag(),true);
 assert.equal(player.getViewedBagInstanceId(),a.id);
});
test("C17: se TODAS Bags estão cheias, NPC não debita gold nem inventa itens",()=>{
 const {player,npc,rootId}=setup();const children=fillRoot(player,npc);
 for(const {instanceId} of children){
  const target=player.bagInstances.get(instanceId)!;
  target.items.set(bag,10); // 10 slots ocupados em cada Bag
 }
 const before=player.gold,bank=player.bankGold,rootItems=JSON.stringify(player.exportBagState());
 assert.equal(ShopSystem.buyItem(player,npc,potion,1),false);
 assert.equal(player.gold,before);assert.equal(player.bankGold,bank);
 assert.equal(player.equippedBagInstanceId,rootId);
 assert.equal(JSON.stringify(player.exportBagState()),rootItems);
});
test("C17: Bag solta/inacessível não pode armazenar compra",()=>{
 const {player,npc}=setup();const children=fillRoot(player,npc);
 for(const {instanceId} of children)player.bagInstances.get(instanceId)!.items.set(bag,10);
 player.bagInstances.set("orphan",{id:"orphan",itemId:bag,items:new Map(),children:[]});
 const gold=player.gold;
 assert.equal(ShopSystem.buyItem(player,npc,potion,1),false);
 assert.equal(player.gold,gold);
 assert.equal(player.bagInstances.get("orphan")!.items.has(potion),false);
});
test("C17: CAP cheio recusa compra mesmo com Bag interna livre, sem cobrar banco",()=>{
 const {player,npc}=setup();const children=fillRoot(player,npc);
 player.bagInstances.get(children[0].instanceId)!.items.set(potion,450);
 const gold=player.gold,bank=player.bankGold,amount=player.bagInstances.get(children[0].instanceId)!.items.get(potion);
 assert.equal(ShopSystem.buyItem(player,npc,potion,1),false);
 assert.equal(player.gold,gold);assert.equal(player.bankGold,bank);
 assert.equal(player.bagInstances.get(children[0].instanceId)!.items.get(potion),amount);
});
test("C17: depois de comprar dentro de uma Bag é possível largá-la sem perder árvore",()=>{
 const {player,npc,rootId}=setup();
 const children=fillRoot(player,npc);
 assert.equal(ShopSystem.buyItem(player,npc,potion,3),true);
 const saved=player.exportBagState();
 const copy=new Player("clone","Clone",2,2);
 copy.equipment.set(EquipmentSlot.BACKPACK,bag);
 copy.restoreBagState(JSON.parse(JSON.stringify(saved)));
 assert.equal(copy.equippedBagInstanceId,rootId);
 assert.equal(copy.bagInstances.get(children[0].instanceId)?.items.get(potion),3);
 // A referência da Bag filha é portada sem trocar UUID.
 assert.equal(copy.detachBagForGround(bag,false,children[0].instanceId)?.equippedId,
  children[0].instanceId);
});
test("C17: UI sem tecla P, Stats via ícone, CAP restante e títulos removidos",()=>{
 const file=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
 const shell=file("UI/C8SidebarShell.cs"),dock=file("UI/C8SidebarDynamicDock.cs");
 const status=file("Managers/StatusManager.cs");
 assert.match(shell,/capLabel.text = latestCapMaximum > 0f/);
 assert.match(shell,/CAP  \{latestCapRemaining:0\.#\}/);
 assert.doesNotMatch(shell,/\/ \{latestCapMaximum:0\.#\} oz/);
 for(const word of ["CONTEINÊRES  /  LOOT","ACESSO RÁPIDO","EQUIPAMENTOS"])
  assert.doesNotMatch(shell,new RegExp('AddText\\([^\\n]*"'+word+'"'));
 assert.match(shell,/AddIcon\(icons, "SettingsIcon", 0, slots\)/);
 assert.match(shell,/AddIcon\(icons, "StatsIcon", 1, slots\)/);
 assert.match(shell,/const int slots = 7/);
 assert.doesNotMatch(status,/<Keyboard>\/p|toggleStatusAction/);
 assert.match(status,/statsIconButton\.onClick\.AddListener\(TogglePanel\)/);
 assert.match(status,/DockToSidebar\(RectTransform host\)/);
 assert.match(status,/C17StatsViewport/);
 assert.match(dock,/StatusManager\.Instance\?\.DockToSidebar/);
 assert.doesNotMatch(dock,/BuildTabs\(\)/);
 assert.match(dock,/if \(statsActive\)/);
});

test("C17: botão Stats fica ao lado da engrenagem e logout não o encobre",()=>{
 const files=(p:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",p),"utf8");
 const shell=files("UI/C8SidebarShell.cs");
 const login=files("Networking/SessionLoginDebugUI.cs");
 const status=files("Managers/StatusManager.cs");
 const dock=files("UI/C8SidebarDynamicDock.cs");
 assert.match(shell,/AddIcon\(icons, "SettingsIcon", 0, slots\)/);
 assert.match(shell,/AddIcon\(icons, "StatsIcon", 1, slots\)/);
 assert.match(shell,/AddIcon\(icons, "MapIcon", 5, slots\)/);
 assert.match(shell,/const int slots = 7/);
 assert.match(shell,/case 1: \/\/ Stats/);
 assert.match(shell,/AddCenterText\(obj.transform, "StatsSymbol", "S"/);
 assert.match(login,/logoutButtonRect\.anchorMin = new Vector2\(6f \/ 7f \+ 0\.008f, 0f\)/);
 assert.doesNotMatch(login,/logoutButtonRect\.anchorMin = new Vector2\(5f \/ 6f/);
 assert.match(status,/public bool IsDockedToSidebar/);
 assert.match(status,/statusPanel\.transform\.parent == C8SidebarShell\.Instance\.StatsHost/);
 assert.match(status,/if \(statusPanel\.transform\.parent != host\)/);
 assert.match(status,/statsIconButton\.onClick\.AddListener\(TogglePanel\)/);
 assert.match(dock,/!StatusManager\.Instance\.IsDockedToSidebar/);
 assert.match(dock,/StatusManager\.Instance\.DockToSidebar\(shell\.DynamicHost\)/);
 assert.doesNotMatch(status,/<Keyboard>\/p|toggleStatusAction/);
});
