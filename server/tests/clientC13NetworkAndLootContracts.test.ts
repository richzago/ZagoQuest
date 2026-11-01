import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClientMessage } from "../src/network/validation/messageValidation";

const root = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts");
const unity = (p: string) => readFileSync(join(root,p),"utf8");

test("C13: versões sem UUID nunca serializam campo instanceId e preservam origem", () => {
  const dto = unity("Networking/Messages/Outgoing/OutgoingMessages.cs");
  const sender = unity("Networking/Senders/InventorySender.cs");
  const base = unity("Networking/Senders/BaseSender.cs");
  assert.match(base,/JsonUtility\.ToJson\(payload\)/);
  for (const command of ["OpenBag","EquipItem","DropItem"]) {
    assert.match(dto,new RegExp("class "+command+"WithoutInstanceMessage \\{"));
    const line = dto.split("\n").find(l=>l.includes("class "+command+"WithoutInstanceMessage"));
    assert.ok(line && !line.includes("instanceId"),command+" jamais envia instanceId quando ausente");
    assert.match(sender,new RegExp("new "+command+"WithoutInstanceMessage"));
  }
  assert.match(sender,/string\.IsNullOrWhiteSpace\(instanceId\)/);
  assert.match(sender,/fromEquipment = fromEquipment/);
  assert.match(sender,/new DropItemMessage/);
  for (const message of [
    {type:"dropItem",itemId:"equipment/backpack/simple_bag",amount:1,x:24,y:7,fromEquipment:true},
    {type:"dropItem",itemId:"bone_sword",amount:1,x:22,y:11,fromEquipment:false},
    {type:"equipItem",itemId:"equipment/weapon/swords/boneSword"},
    {type:"openBag",itemId:"equipment/backpack/simple_bag"},
    {type:"openBag",itemId:"equipment/backpack/simple_bag",instanceId:"bag-uuid"},
    {type:"dropItem",itemId:"equipment/backpack/simple_bag",amount:1,x:24,y:7,fromEquipment:false,instanceId:"bag-uuid"},
  ]) assert.equal(parseClientMessage(JSON.stringify(message)).ok,true,JSON.stringify(message));
  for (const type of ["dropItem","equipItem","openBag"]) {
    const fields = type==="dropItem"
      ? {itemId:"bone_sword",amount:1,x:2,y:3,fromEquipment:false}
      : {itemId:"equipment/backpack/simple_bag"};
    for (const instanceId of [null,"",42]) {
      assert.equal(parseClientMessage(JSON.stringify({type,...fields,instanceId})).ok,false);
    }
  }
});

test("C13: o loot utiliza retângulo fixado ao topo em vez de ocupar altura errada",()=>{
  const dock=unity("UI/C8SidebarDynamicDock.cs");
  const loot=unity("UI/LootUI.cs");
  assert.match(dock,/float lootHeight = showLoot \? Mathf\.Min\(lootMax,/);
  assert.match(dock,/r\.anchorMin = new Vector2\(0f, 1f\);\s*r\.anchorMax = new Vector2\(1f, 1f\)/);
  assert.match(dock,/r\.offsetMin = new Vector2\(0f, -lootTop - lootHeight\)/);
  assert.match(dock,/lootGroup\.blocksRaycasts = showLoot/);
  assert.match(loot,/row\.Setup\(visibleItems\[i\], i, OnItemClicked\)/);
  assert.match(loot,/NetworkManager\.Instance\.Inventory\.SendTakeLoot\(currentCorpseId, false, index\)/);
  const slot=unity("UI/LootItemSlot.cs");
  assert.match(slot,/DragDropManager\.PointerBlocksWorldDrop\(eventData\)/);
  assert.match(slot,/onItemClick\?\.Invoke\(index\)/);
});

test("C13: APIs Unity/TMP atualizadas sem alterar F10 nem entrada",()=>{
  const files=["UI/LootItemSlot.cs","Networking/SessionLoginDebugUI.cs","UI/C8SidebarShell.cs"];
  for (const file of files) assert.doesNotMatch(unity(file),/enableWordWrapping/);
  assert.match(unity("UI/LootItemSlot.cs"),/textWrappingMode = TextWrappingModes\.NoWrap/);
  assert.match(unity("UI/C8SidebarShell.cs"),/textWrappingMode = TextWrappingModes\.Normal/);
  const access=unity("UI/C7UiAccessibility.cs");
  assert.match(access,/FindObjectsByType<CanvasScaler>\(FindObjectsInactive\.Include\)/);
  assert.doesNotMatch(access,/FindObjectsSortMode/);
  assert.match(access,/Scales\[current\]/);
});
