import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { generateId } from "../../shared/utils/idUtils";

export async function handleUseItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  const { itemId } = msg;
  const item = ItemRegistry.get(itemId);
  if (!item) {
    ctx.packetSender.inventory.sendItemUsed(itemId, false, "Item não encontrado.");
    return;
  }

  if (!player.hasItem(itemId, 1)) {
    ctx.packetSender.inventory.sendItemUsed(itemId, false, "Você não possui este item.");
    return;
  }

  if (item.type === "consumable") {
    let message = "";
    let effectApplied = false;

    const healAmount = (item as any).healAmount ?? (item as any).heal ?? 0;
    if (healAmount > 0) {
      const actualHeal = Math.min(player.maxHp - player.hp, healAmount);
      if (actualHeal > 0) {
        player.hp += actualHeal;
        message = `Você recuperou ${actualHeal} HP.`;
        effectApplied = true;
      } else {
        message = "Seu HP já está cheio.";
      }
    }

    const manaAmount = (item as any).manaAmount ?? (item as any).mana ?? 0;
    if (manaAmount > 0) {
      const actualMana = Math.min(player.maxMana - player.mana, manaAmount);
      if (actualMana > 0) {
        player.mana += actualMana;
        message = `Você recuperou ${actualMana} de mana.`;
        effectApplied = true;
      } else if (!effectApplied) {
        message = "Sua mana já está cheia.";
      }
    }

    if (!effectApplied) {
      ctx.packetSender.inventory.sendItemUsed(itemId, false, message);
      return;
    }

    player.removeItem(itemId, 1);
    ctx.packetSender.inventory.sendItemUsed(itemId, true, message);
    ctx.packetSender.inventory.sendInventory(player);
    ctx.packetSender.inventory.sendPlayerStats(player);
    return;
  }

  if (item.type === "equipment") {
    const success = player.equipItem(itemId);
    if (success) {
      ctx.packetSender.inventory.sendItemUsed(itemId, true, `Você equipou ${item.name}.`);
      ctx.packetSender.inventory.sendInventory(player);
      ctx.packetSender.inventory.sendPlayerStats(player);
      ctx.packetSender.inventory.sendEquipment(player);
    } else {
      ctx.packetSender.inventory.sendItemUsed(
        itemId,
        false,
        "Não foi possível equipar este item (nível, slot, etc.).",
      );
    }
    return;
  }

  ctx.packetSender.inventory.sendItemUsed(
    itemId,
    false,
    "Este item não pode ser usado ou equipado.",
  );
}

export async function handleEquipItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  const success = player.equipItem(msg.itemId);
  if (success) {
    ctx.packetSender.inventory.sendInventory(player);
    ctx.packetSender.inventory.sendPlayerStats(player);
    ctx.packetSender.inventory.sendEquipment(player);
  } else {
    ctx.packetSender.inventory.sendError("Não foi possível equipar o item.");
  }
}

export async function handleUnequipItem(
  ws: WebSocket,
  player: Player,
  msg: { slot: string },
  ctx: HandlerContext,
): Promise<void> {
  const slotKey = msg.slot.toUpperCase() as keyof typeof EquipmentSlot;
  const slot = EquipmentSlot[slotKey];

  if (slot === undefined) {
    ctx.packetSender.inventory.sendError("Slot inválido.");
    Logger.warn(`[Unequip] Slot inválido recebido: ${msg.slot}`);
    return;
  }

  const success = player.unequipItem(slot);
  if (success) {
    ctx.packetSender.inventory.sendInventory(player);
    ctx.packetSender.inventory.sendPlayerStats(player);
    ctx.packetSender.inventory.sendEquipment(player);
    ctx.packetSender.inventory.sendUnequipResult(true, "Item desequipado.");
  } else {
    ctx.packetSender.inventory.sendUnequipResult(false, "Falha ao desequipar.");
  }
}

export async function handleDropItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string; amount?: number; x: number; y: number },
  ctx: HandlerContext,
): Promise<void> {
  const { itemId, amount = 1, x, y } = msg;

  const dx = Math.abs(Math.floor(x) - Math.floor(player.position.x));
  const dy = Math.abs(Math.floor(y) - Math.floor(player.position.y));
  if (dx + dy > 2) {
    ctx.packetSender.inventory.sendDropError("Muito longe para dropar.");
    return;
  }

  if (!player.hasItem(itemId, amount)) {
    let equippedSlot: EquipmentSlot | null = null;
    for (const [slot, equippedItemId] of player.equipment.entries()) {
      if (equippedItemId === itemId) {
        equippedSlot = slot;
        break;
      }
    }

    if (equippedSlot !== null) {
      const unequipSuccess = player.unequipItem(equippedSlot);
      if (!unequipSuccess) {
        ctx.packetSender.inventory.sendDropError("Não foi possível desequipar o item.");
        return;
      }
      Logger.system(`${player.name} desequipou ${itemId} para dropar.`);
    } else {
      ctx.packetSender.inventory.sendDropError("Você não possui este item.");
      return;
    }
  }

  if (!player.removeItem(itemId, amount)) {
    ctx.packetSender.inventory.sendDropError("Erro ao remover o item.");
    return;
  }

  const itemDef = ItemRegistry.get(itemId);
  const itemName = itemDef?.name || itemId;

  const newId = generateId();
  const itemOnGround = new ItemOnGround(
    newId,
    itemId,
    amount,
    Math.floor(x),
    Math.floor(y),
    itemName,
  );
  ctx.world.addItemOnGround(itemOnGround);

  ctx.wsServer.broadcastSpawnItemOnGround(itemOnGround);
  ctx.packetSender.inventory.sendInventory(player);
  ctx.packetSender.inventory.sendEquipment(player);

  Logger.loot(`${player.name} dropou ${amount}x ${itemId} em (${Math.floor(x)}, ${Math.floor(y)})`);
}

export async function handlePickupItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  Logger.system(`[Pickup] Recebido pickup para item ${msg.itemId}`);

  const itemOnGround = ctx.world.getItemOnGround(msg.itemId);
  if (!itemOnGround) {
    ctx.packetSender.inventory.sendPickupError("Item não encontrado no chão.");
    return;
  }

  const dx = Math.abs(itemOnGround.position.x - player.position.x);
  const dy = Math.abs(itemOnGround.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.inventory.sendPickupError("Muito longe para pegar.");
    return;
  }

  player.addItem(itemOnGround.itemId, itemOnGround.amount);
  ctx.world.removeItemOnGround(itemOnGround);
  ctx.wsServer.broadcastDespawn(itemOnGround.id);
  ctx.packetSender.inventory.sendInventory(player);

  Logger.loot(`${player.name} pegou ${itemOnGround.amount}x ${itemOnGround.itemId} do chão.`);
}
