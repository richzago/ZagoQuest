/**
 * Contratos de rede ZagoQuest: wire format Node -> Unity e novos comandos
 * Unity -> Node. Usa capturas reais dos senders e leitura estática dos .cs.
 *
 * Aviso: a leitura estática do C# NÃO substitui compilar o projeto no Unity.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { WebSocket } from "ws";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { World } from "../src/game/world/World";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";
import { BankSender } from "../src/network/senders/bankSender";
import { InventorySender } from "../src/network/senders/inventorySender";
import { NpcInteractionSystem } from "../src/game/systems/npcInteractionSystem";
import { handleCloseBank } from "../src/network/handlers/bank.handler";
import { handleCloseShop } from "../src/network/handlers/shop.handler";
import { parseClientMessage } from "../src/network/validation/messageValidation";
import { handlers } from "../src/network/handlers";

function unity(relative: string): string {
  return readFileSync(path.join(
    process.cwd(), "..", "Client/Assets/Resources/Scripts", relative,
  ), "utf8");
}

function capturePackets() {
  const packets: Record<string, unknown>[] = [];
  const ws = {
    send(raw: string) {
      packets.push(JSON.parse(raw) as Record<string, unknown>);
    },
  } as unknown as WebSocket;
  return { ws, packets };
}

function sessionWorld() {
  const world = new World();
  world.generateMap(12, 12);
  const player = new Player("player-1", "Testador", 2, 2);
  const banker = new Npc("bank-1", "Banker", 3, 2, "Olá", "banker");
  const merchant = new Npc("shop-1", "Merchant", 2, 3, "Olá", "merchant");
  world.addPlayer(player);
  world.addNpc(banker);
  world.addNpc(merchant);
  return { world, player, banker, merchant };
}

test("contrato real bankWindow: campo gold, nunca inventoryGold", () => {
  const { ws, packets } = capturePackets();
  new BankSender(ws).sendBankWindow("bank-1", 100, 25);
  assert.deepEqual(packets, [{
    type: "bankWindow", npcId: "bank-1", bankGold: 100, gold: 25,
  }]);
  assert.equal(Object.hasOwn(packets[0], "inventoryGold"), false);
  const dto = unity("Networking/Messages/Incoming/IncomingMessages.cs");
  assert.match(dto, /class BankWindowMessage[^\n]*bankGold;[^\n]*gold;/);
});

test("contrato real bankResult mantém success, message, bankGold e gold", () => {
  const { ws, packets } = capturePackets();
  new BankSender(ws).sendBankResult(true, "Depositou.", 200, 10);
  assert.deepEqual(packets, [{
    type: "bankResult", success: true, message: "Depositou.", bankGold: 200, gold: 10,
  }]);
  const dto = unity("Networking/Messages/Incoming/IncomingMessages.cs");
  assert.match(dto, /class BankResultMessage[^\n]*bankGold;[^\n]*gold;/);
});

test("contrato real equipment: items é array de slot/itemId, não slots", () => {
  const { ws, packets } = capturePackets();
  const player = new Player("player-1", "Equip", 2, 2);
  player.equipment.set(EquipmentSlot.HELMET, "equipment/armor/helmet");
  new InventorySender(ws).sendEquipment(player);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].type, "equipment");
  assert.equal(Array.isArray(packets[0].items), true);
  assert.deepEqual((packets[0].items as {slot:string;itemId:string}[])
    .find((entry) => entry.slot === "helmet"),
    { slot: "helmet", itemId: "equipment/armor/helmet" });
  assert.equal(Object.hasOwn(packets[0], "slots"), false);
  assert.match(unity("Networking/Handlers/EquipmentHandler.cs"), /json\["items"\]/);
});

test("contrato real gold tem somente tipo e saldo e Unity atualiza sem limpar inventário", () => {
  const { ws, packets } = capturePackets();
  const player = new Player("player-1", "Saldo", 2, 2);
  player.gold = 123;
  new InventorySender(ws).sendGold(player);
  assert.deepEqual(packets, [{ type: "gold", gold: 123 }]);
  assert.match(unity("UI/InventoryUI.cs"), /public void UpdateGold\(int gold\)/);
  assert.match(unity("Networking/Handlers/ServerFeedbackHandler.cs"), /case "gold":/);
  assert.match(unity("Networking/Handlers/ServerFeedbackHandler.cs"), /UpdateGold\(gold.Value\)/);
});

test("Merchant usa catálogo ilimitado: UI oculta o campo legado e Node não limita compra", () => {
  const source = unity("NPC/ShopItemSlot.cs");
  assert.match(source, /stockText\.gameObject\.SetActive\(false\)/);
  assert.doesNotMatch(source, /item\.stock/);
  const system = readFileSync(path.join(process.cwd(), "src/game/systems/shopSystem.ts"), "utf8");
  assert.doesNotMatch(system, /item\.stock/);
  const handler = readFileSync(path.join(process.cwd(), "src/network/handlers/shop.handler.ts"), "utf8");
  assert.doesNotMatch(handler, /stock: item\.stock/);
});

test("24 comandos e schemas de cliente continuam sincronizados", () => {
  assert.equal(Object.keys(handlers).length, 24);
  for (const type of ["closeShop", "closeBank"]) {
    assert.equal(typeof handlers[type], "function");
    assert.equal(parseClientMessage(JSON.stringify({ type, npcId: "npc-1" })).ok, true);
    for (const bad of ["", " ", null, 42]) {
      assert.equal(parseClientMessage(JSON.stringify({ type, npcId: bad })).ok, false);
    }
    // Não permitir que o cliente informe arbitrariamente a identidade do jogador.
    assert.equal(parseClientMessage(JSON.stringify({
      type, npcId: "npc-1", playerId: "outro-jogador",
    })).ok, false);
  }
});

test("sender Unity envia os dois closes com o nome correto", () => {
  const bank = unity("Networking/Senders/BankSender.cs");
  const shop = unity("Networking/Senders/ShopSender.cs");
  assert.match(bank, /SendCloseBank\(string npcId\)/);
  assert.match(bank, /type = "closeBank"/);
  assert.match(shop, /SendCloseShop\(string npcId\)/);
  assert.match(shop, /type = "closeShop"/);
  const outgoing = unity("Networking/Messages/Outgoing/OutgoingMessages.cs");
  assert.match(outgoing, /class CloseBankMessage/);
  assert.match(outgoing, /class CloseShopMessage/);
});

test("botões fechar no Unity enviam close com ID da janela", () => {
  const bank = unity("UI/BankUI.cs");
  const shop = unity("UI/ShopUI.cs");
  assert.match(bank, /SendCloseBank\(currentNpcId\)/);
  assert.match(shop, /SendCloseShop\(currentNpcId\)/);
});

test("fechamento de janela válida revoga somente a sessão correspondente", () => {
  const { world, player, banker, merchant } = sessionWorld();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(NpcInteractionSystem.closeIfActive(player, "banker", "outro"), false);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), banker);
  assert.equal(NpcInteractionSystem.closeIfActive(player, "merchant", banker.id), false);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), banker);
  assert.equal(NpcInteractionSystem.closeIfActive(player, "banker", banker.id), true);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  assert.equal(NpcInteractionSystem.closeIfActive(player, "merchant", merchant.id), true);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant"), undefined);
});

test("closeBank atrasado nunca cancela uma loja aberta posteriormente", () => {
  const { world, player, banker, merchant } = sessionWorld();
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  const ctx = { world } as HandlerContext;
  handleCloseBank({} as WebSocket, player, { type: "closeBank", npcId: banker.id }, ctx);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant", merchant.id), merchant);
  handleCloseShop({} as WebSocket, player, { type: "closeShop", npcId: merchant.id }, ctx);
  assert.equal(NpcInteractionSystem.getActive(player, world, "merchant"), undefined);
});

test("closeShop atrasado nunca cancela um banco aberto posteriormente", () => {
  const { world, player, banker, merchant } = sessionWorld();
  assert.equal(NpcInteractionSystem.open(player, world, merchant, "merchant"), true);
  assert.equal(NpcInteractionSystem.open(player, world, banker, "banker"), true);
  const ctx = { world } as HandlerContext;
  handleCloseShop({} as WebSocket, player, { type: "closeShop", npcId: merchant.id }, ctx);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), banker);
  handleCloseBank({} as WebSocket, player, { type: "closeBank", npcId: banker.id }, ctx);
  assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
});

test("registry Unity reconhece todos os avisos já enviados pelo Node", () => {
  const source = unity("Networking/Handlers/PacketHandlerRegistry.cs");
  for (const name of [
    "gold", "attackFailed", "autoAttackStarted", "monsterDied",
    "pickupError", "error", "networkError",
  ]) {
    assert.ok(source.includes(`Register("${name}",`), `Handler Unity ausente: ${name}`);
  }
  const feedback = unity("Networking/Handlers/ServerFeedbackHandler.cs");
  for (const name of ["gold", "attackFailed", "autoAttackStarted", "monsterDied", "pickupError", "error"]) {
    assert.ok(feedback.includes(`case "${name}":`));
  }
});

test("DTOs Unity incluem todos os tipos de retorno adicional", () => {
  const dto = unity("Networking/Messages/Incoming/IncomingMessages.cs");
  for (const name of [
    "GoldMessage", "AttackFailedMessage", "AutoAttackStartedMessage",
    "MonsterDiedMessage", "PickupErrorMessage", "ErrorMessage",
    "NetworkErrorMessage",
  ]) assert.ok(dto.includes(`class ${name}`), `DTO ausente: ${name}`);
});

test("takeLoot Unity omite itemIndex ao pegar tudo e mantém índice válido no individual", () => {
  // A inspeção dos C# é estática; a serialização real será validada no Unity.
  const dto = unity("Networking/Messages/Outgoing/OutgoingMessages.cs");
  const sender = unity("Networking/Senders/InventorySender.cs");
  assert.match(dto, /class TakeAllLootMessage \{[^}]*takeAll;\s*\}/);
  assert.doesNotMatch(dto.match(/class TakeAllLootMessage \{[^}]*\}/)?.[0] ?? "", /itemIndex/);
  assert.match(sender, /if \(takeAll\)[\s\S]*?new TakeAllLootMessage/);
  assert.match(sender, /if \(itemIndex < 0\)/);
  assert.match(sender, /new TakeLootMessage[\s\S]*?itemIndex = itemIndex/);
});
