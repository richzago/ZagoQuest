/**
 * inventory.handler.ts
 *
 * Handlers relacionados ao inventário, equipamento e itens no chão.
 *
 * @module network/handlers/inventory
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { generateId } from "../../shared/utils/idUtils";
import { isValidItemId, isValidQuantity } from "../../game/systems/economyRules";
import { FoodRegenerationSystem } from "../../game/systems/foodRegenerationSystem";
import type {
  ClientUseItemMessage,
  ClientEquipItemMessage,
  ClientUnequipItemMessage,
  ClientDropItemMessage,
  ClientPickupItemMessage,
} from "../messages";

export async function handleUseItem(
  ws: WebSocket,
  player: Player,
  msg: ClientUseItemMessage,
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
    // Food é duração de saciedade (regen por segundos), distinta de poção
    // instantânea. Tudo acontece no Node; o Unity não calcula HP/mana.
    if (item.foodSeconds !== undefined) {
      if (!FoodRegenerationSystem.canEat(player, item.foodSeconds)) {
        ctx.packetSender.inventory.sendItemUsed(itemId, false,
          "Você já está satisfeito ou não pode comer agora.");
        return;
      }
      if (!player.removeItem(itemId, 1)) {
        ctx.packetSender.inventory.sendItemUsed(itemId, false,
          "Você não possui este alimento.");
        return;
      }
      FoodRegenerationSystem.feed(player, item.foodSeconds);
      ctx.packetSender.inventory.sendItemUsed(itemId, true,
        `Você comeu ${item.name}. Saciedade: ${FoodRegenerationSystem.remainingSeconds(player)}s.`);
      ctx.packetSender.inventory.sendInventory(player);
      // Nenhuma regeneração antecipada: os próximos ticks enviam stats reais.
      return;
    }

    let message = "";
    let effectApplied = false;

    // Contrato real dos JSONs: effect.healHp/heelMana.
    // Campos antigos flat eram inexistentes e deixavam poções sem efeito.
    const healAmount = item.effect?.healHp ?? 0;
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

    const manaAmount = item.effect?.healMana ?? 0;
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
  msg: ClientEquipItemMessage,
  ctx: HandlerContext,
): Promise<void> {
  Logger.system(`[EQUIP] Recebido equipItem de ${player.name}: itemId=${msg.itemId}`);
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
  msg: ClientUnequipItemMessage,
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

/**
 * Drop seguro: valida quantidade e destino ANTES de tocar no inventário.
 * Se o item estiver equipado, só permite dropar uma unidade.
 */
export async function handleDropItem(
  ws: WebSocket,
  player: Player,
  msg: ClientDropItemMessage,
  ctx: HandlerContext,
): Promise<void> {
  const { itemId, amount = 1, x, y } = msg;
  if (!isValidItemId(itemId) || !isValidQuantity(amount) ||
      !Number.isFinite(x) || !Number.isFinite(y)) {
    ctx.packetSender.inventory.sendDropError("Dados de drop inválidos.");
    return;
  }

  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const distance = Math.abs(tileX - Math.floor(player.position.x)) +
                   Math.abs(tileY - Math.floor(player.position.y));

  if (!ctx.world.isWithinBounds(tileX, tileY) || distance > 2) {
    ctx.packetSender.inventory.sendDropError("Local de drop inválido ou distante.");
    return;
  }

  const alreadyInBag = player.hasItem(itemId, amount);
  const equippedSlot = [...player.equipment.entries()]
    .find(([, equippedId]) => equippedId === itemId)?.[0];

  // Nunca desequipar para depois descobrir que a quantidade era insuficiente.
  if (!alreadyInBag && !(amount === 1 && equippedSlot !== undefined)) {
    ctx.packetSender.inventory.sendDropError("Você não possui essa quantidade.");
    return;
  }

  // Todos os dados do item ficam prontos antes da remoção.
  let itemName = itemId;
  try { itemName = ItemRegistry.get(itemId).name; } catch { /* item antigo sem definição */ }
  const onGround = new ItemOnGround(generateId(), itemId, amount, tileX, tileY, itemName);

  if (!alreadyInBag && equippedSlot !== undefined && !player.unequipItem(equippedSlot)) {
    ctx.packetSender.inventory.sendDropError("Falha ao desequipar o item.");
    return;
  }

  if (!player.removeItem(itemId, amount)) {
    ctx.packetSender.inventory.sendDropError("Falha ao remover o item.");
    return;
  }

  ctx.world.addItemOnGround(onGround);
  ctx.broadcast.broadcastSpawnItemOnGround(onGround);
  ctx.packetSender.inventory.sendInventory(player);
  ctx.packetSender.inventory.sendEquipment(player);
  Logger.loot(`${player.name} dropou ${amount}x ${itemId} em (${tileX},${tileY})`);
}

/** Pickup só despawna o item depois de adicioná-lo ao jogador com sucesso. */
export async function handlePickupItem(
  ws: WebSocket,
  player: Player,
  msg: ClientPickupItemMessage,
  ctx: HandlerContext,
): Promise<void> {
  const onGround = ctx.world.getItemOnGround(msg.itemId);
  if (!onGround) {
    ctx.packetSender.inventory.sendPickupError("Item não encontrado no chão.");
    return;
  }

  const distance = Math.abs(onGround.position.x - player.position.x) +
                   Math.abs(onGround.position.y - player.position.y);
  if (distance > 2) {
    ctx.packetSender.inventory.sendPickupError("Muito longe para pegar.");
    return;
  }

  if (!player.addItem(onGround.itemId, onGround.amount)) {
    ctx.packetSender.inventory.sendPickupError("Não foi possível adicionar este item.");
    return;
  }

  ctx.world.removeItemOnGround(onGround);
  ctx.broadcast.broadcastDespawn(onGround.id);
  ctx.packetSender.inventory.sendInventory(player);
  Logger.loot(`${player.name} coletou ${onGround.amount}x ${onGround.itemId}.`);
}
