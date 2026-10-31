/**
 * C6 / Inventário e Equipamentos — contratos Unity.
 * A CI Node lê o C# versionado, mas não o compila/executa: homologação
 * Editor + build Windows permanece obrigatória.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const unity=(file:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",file),"utf8");

test("C6: atalho I usa callback removível, ignora chat e libera InputAction/singleton",()=>{
 const s=unity("UI/InventoryUI.cs");
 assert.match(s,/toggleInventoryAction\.performed \+= OnToggleInventory/);
 assert.match(s,/toggleInventoryAction\.performed -= OnToggleInventory/);
 assert.match(s,/toggleInventoryAction\.Dispose\(\)/);
 assert.match(s,/if \(Instance == this\) Instance = null/);
 assert.match(s,/GetComponentInParent<TMP_InputField>\(\)/);
 assert.match(s,/if \(inventoryPanel == null\) return/);
 assert.doesNotMatch(s,/performed -= ctx => ToggleInventory/);
 assert.match(s,/network\.Inventory\.SendEquipItem\(itemId\)/);
});

test("C6: snapshots de equipment limpam slots ausentes e não mantêm singleton obsoleto",()=>{
 const s=unity("UI/EquipmentUI.cs");
 assert.match(s,/if \(Instance == this\) Instance = null/);
 assert.match(s,/if \(slotsContainer == null\)/);
 assert.match(s,/foreach \(var kvp in slotMap\)/);
 assert.match(s,/equipment\.TryGetValue\(kvp\.Key, out string itemId\)/);
 assert.match(s,/kvp\.Value\.SetItem\(itemId\)/);
 const slot=unity("UI/EquipmentSlotUI.cs");
 assert.match(slot,/if \(string\.IsNullOrEmpty\(currentItemId\)\) ClearItem\(\)/);
});

test("C6: arrastar inventário para slot envia equipItem uma vez, sem drop de chão",()=>{
 const eq=unity("UI/EquipmentSlotUI.cs");
 const inv=unity("Player/InventorySlot.cs");
 const drag=unity("Managers/DragDropManager.cs");
 assert.match(eq,/DragDropManager\.Instance\.IsFromInventory\(\)/);
 assert.match(eq,/DragDropManager\.Instance\.DropOnEquipmentSlot\(slotType\)/);
 assert.match(drag,/NetworkManager\.Instance\?\.Inventory\.SendEquipItem\(draggedItemId\)/);
 assert.match(inv,/if \(DragDropManager\.Instance == null \|\| !DragDropManager\.Instance\.IsDragging\(\)\) return/);
 assert.match(inv,/GetComponentInParent<EquipmentSlotUI>\(\)/);
 assert.match(inv,/target\.GetComponentInParent<Canvas>\(\) != null/);
 assert.match(eq,/target\.GetComponentInParent<Canvas>\(\) != null/);
 assert.match(eq,/NetworkManager\.Instance/);
});

test("C6: servidor permanece autoritativo para equipar, desequipar e drop",()=>{
 const send=unity("Networking/Senders/InventorySender.cs");
 const src=readFileSync(join(process.cwd(),"src/network/handlers/inventory.handler.ts"),"utf8");
 assert.match(send,/SendEquipItem\(string itemId\)/);
 assert.match(send,/SendUnequipItem\(EquipmentSlot slot\)/);
 assert.match(send,/SendDropItem\(string itemId, int amount, int x, int y\)/);
 assert.match(src,/handleEquipItem/);
 assert.match(src,/handleUnequipItem/);
 assert.match(src,/handleDropItem/);
});


test("C6 visual: grade rolável e drop no inventário mesmo vazio",()=>{
 const layout=unity("UI/C6InventoryEquipmentLayout.cs");
 const inv=unity("UI/InventoryUI.cs");
 const slot=unity("Player/InventorySlot.cs");
 const eq=unity("UI/EquipmentSlotUI.cs");
 assert.match(layout,/GridLayoutGroup\.Constraint\.FixedColumnCount/);
 assert.match(layout,/grid\.constraintCount = 3/);
 assert.match(layout,/RectMask2D/);
 assert.match(layout,/ScrollRect/);
 assert.match(unity("UI/C6InventoryDropTarget.cs"),/class C6InventoryDropTarget/);
 assert.match(unity("UI/C6InventoryDropTarget.cs"),/drag\.DropOnInventorySlot\(\)/);
 assert.match(layout,/EquipmentSlot\.HELMET/);
 assert.match(inv,/C6InventoryEquipmentLayout\.Inventory/);
 assert.match(inv,/public void CloseInventory\(\)/);
 assert.match(slot,/amount > 1 \? \$"x\{amount:N0\}"/);
 assert.match(slot,/clickImage\.raycastTarget = false/);
 assert.match(eq,/slotText\.text = slotType\.ToString\(\)/);
 assert.doesNotMatch(eq,/new Texture2D\(/);
});


test("C6 visual: a cena mantém as referências de inventário/equipamento que o layout usa",()=>{
 const scene=readFileSync(join(process.cwd(),"..","Client","Assets","scenebasic.unity"),"utf8");
 const prefab=readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Prefabs","InventorySlot.prefab"),"utf8");
 for(const key of ["m_Name: InventoryPanel","m_Name: EquipmentPanel",
  "m_Name: SlotsGrid","m_Name: SlotsContainer","m_Name: GoldText",
  "Assembly-CSharp::InventoryUI","Assembly-CSharp::EquipmentUI",
  "UnityEngine.UI::UnityEngine.UI.CanvasScaler"])
  assert.ok(scene.includes(key), "Referência de cena ausente: "+key);
 assert.match(scene,/m_ReferenceResolution: \{x: 1920, y: 1080\}/);
 assert.match(scene,/slotPrefab: \{fileID: [0-9]+, guid: [a-f0-9]+, type: 3\}/);
 assert.match(scene,/slotsGrid: \{fileID: [0-9]+\}/);
 assert.match(scene,/slotsContainer: \{fileID: [0-9]+\}/);
 assert.match(prefab,/Assembly-CSharp::InventorySlot/);
 assert.match(prefab,/amountText: \{fileID: [0-9]+\}/);
 assert.match(prefab,/nameText: \{fileID: [0-9]+\}/);
});

test("C6 visual: botão X sincroniza painel, flag e atalho I; gold vem somente do snapshot",()=>{
 const inv=unity("UI/InventoryUI.cs");
 const visual=unity("UI/C6InventoryEquipmentLayout.cs");
 assert.match(visual,/Header\(panel, "INVENTÁRIO", close\)/);
 assert.match(visual,/onClick\.AddListener\(close\)/);
 assert.match(inv,/public void CloseInventory\(\)[\s\S]*?isInventoryOpen = false;[\s\S]*?inventoryPanel\.SetActive\(false\)/);
 assert.match(inv,/isInventoryOpen = !isInventoryOpen/);
 assert.match(inv,/GetComponentInParent<TMP_InputField>\(\)/);
 assert.match(inv,/public void HandleInventory\(int gold, Dictionary<string, int> newItems\)[\s\S]*?currentGold = gold/);
 assert.match(inv,/public void UpdateGold\(int gold\)[\s\S]*?currentGold = gold/);
 assert.match(inv,/Ouro em mãos: \{currentGold:N0\} gold/);
});

test("C6 visual: soltar sobre viewport vazio envia unequip, não drop no mundo",()=>{
 const viewport=unity("UI/C6InventoryDropTarget.cs");
 const layout=unity("UI/C6InventoryEquipmentLayout.cs");
 const drag=unity("Managers/DragDropManager.cs");
 assert.match(layout,/typeof\(C6InventoryDropTarget\)/);
 assert.match(layout,/viewport\.GetComponent<Image>\(\)\.raycastTarget = true/);
 assert.match(viewport,/IDropHandler/);
 assert.match(viewport,/drag\.IsDragging\(\) && drag\.IsFromEquipment\(\)/);
 assert.match(viewport,/drag\.DropOnInventorySlot\(\)/);
 assert.doesNotMatch(viewport,/DropOnGround/);
 assert.match(drag,/public void DropOnInventorySlot\(\)[\s\S]*?SendUnequipItem\(sourceSlot\.slotType\)/);
});

test("C6 visual: recursos Unity e nomes dos slots permanecem compatíveis",()=>{
 const layout=unity("UI/C6InventoryEquipmentLayout.cs");
 const equipment=unity("UI/EquipmentSlotUI.cs");
 const invSlot=unity("Player/InventorySlot.cs");
 assert.match(layout,/EquipmentSlot\.AMULET/);
 assert.match(layout,/EquipmentSlot\.BACKPACK/);
 assert.match(layout,/EquipmentSlot\.USEFUL/);
 assert.match(layout,/new Vector2\(70, 70\)/);
 assert.match(layout,/new Vector2\(92, 92\)/);
 assert.match(layout,/new RectOffset\(10, 10, 10, 10\)/);
 assert.match(layout,/fitter\.horizontalFit = ContentSizeFitter\.FitMode\.Unconstrained/);
 assert.match(layout,/fitter\.verticalFit = ContentSizeFitter\.FitMode\.PreferredSize/);
 assert.match(equipment,/Resources\.Load<Sprite>\(\$"Icons\/\{itemId\}"\)/);
 assert.match(invSlot,/Resources\.Load<Sprite>\(\$"Icons\/\{itemId\}"\)/);
 assert.doesNotMatch(equipment,/Sprite\.Create|new Texture2D/);
});


test("C6 gameplay: chat não envia em Update/Enter e usa apenas submit TMP ou botão",()=>{
 const chat=unity("UI/ChatUI.cs");
 const update=chat.slice(chat.indexOf("private void Update()"),chat.indexOf("private void ActivateChat()"));
 assert.match(update,/pressedEnter && lastSubmitFrame != Time\.frameCount/);
 assert.match(update,/ActivateChat\(\)/);
 assert.doesNotMatch(update,/SendChat\(\)|\.Chat\.SendChat/);
 assert.match(chat,/inputField\.onSubmit\.AddListener\(OnSubmit\)/);
 assert.match(chat,/sendButton\.onClick\.AddListener\(SendChat\)/);
 assert.match(chat,/lastSendFrame == Time\.frameCount/);
 assert.match(chat,/lastSubmitFrame = Time\.frameCount/);
 assert.match(chat,/network\.Chat\.SendChat\(outgoing\)/);
 assert.match(chat,/inputField\.onSelect\.AddListener\(OnSelect\)/);
});

test("C6 gameplay: chat valida rede, mantém mensagem offline e preserva canais do Node",()=>{
 const chat=unity("UI/ChatUI.cs");
 assert.match(chat,/!network\.isConnected \|\| network\.Chat == null/);
 assert.match(chat,/return; \/\/ Mantém o texto para o jogador tentar novamente/);
 assert.match(chat,/"trade" => "\/t " \+ message/);
 assert.match(chat,/"support" => "\/s " \+ message/);
 assert.match(chat,/"guild" => "\/gmsg " \+ message/);
 assert.match(chat,/message\.StartsWith\("\/"\)/);
 assert.match(chat,/chatDisplay\.richText = false/);
 assert.match(chat,/MaxVisibleMessages = 160/);
 assert.match(chat,/recentMessages\.Count > MaxVisibleMessages/);
 assert.match(chat,/inputField\.onSubmit\.RemoveListener\(OnSubmit\)/);
 assert.match(chat,/inputField\.onSelect\.RemoveListener\(OnSelect\)/);
 assert.match(chat,/inputField\.onDeselect\.RemoveListener\(OnDeselect\)/);
 assert.match(chat,/if \(Instance == this\) Instance = null/);
 assert.match(chat,/OnDisable\(\) => IsChatActive = false/);
});

test("C6 gameplay: HUD apenas exibe snapshot, XP total separado do progresso e barras seguras",()=>{
 const hud=unity("UI/PlayerHUD.cs");
 const handler=unity("Networking/Handlers/PlayerStatsHandler.cs");
 assert.match(handler,/context\.PlayerHUD\?\.UpdateStats\(stats\)/);
 assert.match(hud,/UpdateStats\(PlayerStatsData stats\)/);
 assert.match(hud,/stats\.levelXpToNext/);
 assert.match(hud,/stats\.levelXp/);
 assert.match(hud,/stats\.xp/);
 assert.match(hud,/slider\.maxValue = Mathf\.Max\(1, maximum\)/);
 assert.match(hud,/slider\.value = Mathf\.Clamp\(value, 0, Mathf\.Max\(1, maximum\)\)/);
 assert.match(hud,/slider\.interactable = false/);
 assert.match(hud,/if \(stats\.levelXpToNext <= 0\)/);
 assert.doesNotMatch(hud,/SendPlayerStats|SendGold|SendXp|SendDamage/);
 assert.match(hud,/if \(Instance == this\) Instance = null/);
});

test("C6 gameplay: HUD e chat recebem layout sem alterações na scene serializada",()=>{
 const hud=unity("UI/PlayerHUD.cs");
 const chat=unity("UI/ChatUI.cs");
 const scene=readFileSync(join(process.cwd(),"..","Client","Assets","scenebasic.unity"),"utf8");
 for(const name of ["m_Name: TopCenter","m_Name: PlayerBars","m_Name: ChatPanel",
 "m_Name: TabButtons","m_Name: ChatScrollView","m_Name: ChatInput","m_Name: SendButton"])
  assert.ok(scene.includes(name),"Elemento da cena ausente: "+name);
 assert.match(hud,/private void StyleGameplayHud\(\)/);
 assert.match(hud,/private static void PlaceBar\(/);
 assert.match(hud,/image\.raycastTarget = false/);
 assert.match(chat,/private void StyleChatPanel\(\)/);
 assert.match(chat,/rect\.sizeDelta = new Vector2\(840, 252\)/);
 assert.match(chat,/scrollRect\.offsetMin = new Vector2\(12, 53\)/);
});

test("C6 economia: depósito e saque não enviam duplo clique antes do ACK",()=>{
 const bank=unity("UI/BankUI.cs");
 assert.match(bank,/private bool transferPending/);
 assert.match(bank,/if \(transferPending\) return false/);
 assert.match(bank,/SetTransferPending\(true\);\s*NetworkManager\.Instance\.Bank\.SendDeposit\(amount\)/);
 assert.match(bank,/SetTransferPending\(true\);\s*NetworkManager\.Instance\.Bank\.SendWithdraw\(amount\)/);
 assert.match(bank,/SetTransferPending\(false\);\s*if \(!success\) return;/);
 assert.match(bank,/if \(depositButton != null\) depositButton\.interactable = !pending/);
 assert.match(bank,/if \(withdrawButton != null\) withdrawButton\.interactable = !pending/);
 assert.doesNotMatch(bank,/bankGold\s*[-+*/]=|inventoryGold\s*[-+*/]=/);
});

test("C6 inventário, loja e loot: somente solicitações e confirmação do Node",()=>{
 const inv=unity("UI/InventoryUI.cs");
 const eq=unity("UI/EquipmentUI.cs");
 const loot=unity("UI/LootUI.cs");
 const shop=unity("UI/ShopUI.cs");
 assert.match(inv,/HandleInventory\(int gold, Dictionary<string, int> newItems\)/);
 assert.match(inv,/network\.Inventory\.SendEquipItem\(itemId\)/);
 assert.match(eq,/OnEquipmentUpdate\(Dictionary<EquipmentSlot, string> equipment\)/);
 assert.match(loot,/private bool awaitingServer/);
 assert.match(loot,/if \(!ReadyToTake\(\)/);
 assert.match(loot,/public void OnLootTaken\(string corpseId, int\? itemIndex\)/);
 assert.match(loot,/if \(corpseId != currentCorpseId\) return/);
 assert.match(shop,/public void ShowBuyResult\(bool success, string message\)/);
 assert.match(shop,/NetworkManager\.Instance\?\.Shop\?\.SendCloseShop\(currentNpcId\)/);
});


test("C6 estados vazios: inventory, loot e shop sem itens não exibem estado antigo",()=>{
 const inv=unity("UI/InventoryUI.cs");
 const loot=unity("UI/LootUI.cs");
 const shop=unity("UI/ShopUI.cs");
 assert.match(inv,/ShowEmptyState\(items\.Count == 0\)/);
 assert.match(inv,/C6EmptyInventoryLabel/);
 assert.match(inv,/labelObject\.SetActive\(empty\)/);
 assert.match(shop,/if \(items == null\)/);
 assert.match(shop,/if \(items\.Length == 0\)/);
 assert.match(shop,/C6ShopEmptyState/);
 assert.match(shop,/itemSlots\.Clear\(\)/);
 assert.match(loot,/if \(visibleItems\.Count == 0\)/);
 assert.match(loot,/C6LootEmptyState/);
 assert.match(loot,/takeAllButton\.interactable = visibleItems\.Count > 0 && !awaitingServer/);
 assert.match(loot,/itemSlots\.Clear\(\)/);
});
