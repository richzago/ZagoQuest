import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { generateId } from "../../shared/utils/idUtils";

/**
 * Processa o uso de um item (consumível ou equipamento).
 */
export async function handleUseItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  const { itemId } = msg;
  const item = ItemRegistry.get(itemId);
  if (!item) {
    ctx.packetSender.sendItemUsed(itemId, false, "Item não encontrado.");
    return;
  }

  if (!player.hasItem(itemId, 1)) {
    ctx.packetSender.sendItemUsed(itemId, false, "Você não possui este item.");
    return;
  }

  // =========================
  // ITEM CONSUMÍVEL
  // =========================
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
      ctx.packetSender.sendItemUsed(itemId, false, message);
      return;
    }

    player.removeItem(itemId, 1);
    ctx.packetSender.sendItemUsed(itemId, true, message);
    ctx.packetSender.sendInventory(player);
    ctx.packetSender.sendPlayerStats(player);
    return;
  }

  // =========================
  // ITEM EQUIPÁVEL
  // =========================
  if (item.type === "equipment") {
    const success = player.equipItem(itemId);
    if (success) {
      ctx.packetSender.sendItemUsed(itemId, true, `Você equipou ${item.name}.`);
      ctx.packetSender.sendInventory(player);
      ctx.packetSender.sendPlayerStats(player);
      ctx.packetSender.sendEquipment(player);
    } else {
      ctx.packetSender.sendItemUsed(
        itemId,
        false,
        "Não foi possível equipar este item (nível, slot, etc.).",
      );
    }
    return;
  }

  ctx.packetSender.sendItemUsed(itemId, false, "Este item não pode ser usado ou equipado.");
}

/**
 * Processa o comando de equipar um item do inventário.
 */
export async function handleEquipItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  const { itemId } = msg;
  const success = player.equipItem(itemId);
  if (success) {
    ctx.packetSender.sendItemUsed(itemId, true, "Item equipado.");
    ctx.packetSender.sendInventory(player);
    ctx.packetSender.sendPlayerStats(player);
    ctx.packetSender.sendEquipment(player);
  } else {
    ctx.packetSender.sendItemUsed(itemId, false, "Não foi possível equipar o item.");
  }
}

/**
 * Processa o comando de desequipar item de um slot específico.
 */
export async function handleUnequipItem(
  ws: WebSocket,
  player: Player,
  msg: { slot: string },
  ctx: HandlerContext,
): Promise<void> {
  // Converte a string para o enum EquipmentSlot
  const slotKey = msg.slot.toUpperCase() as keyof typeof EquipmentSlot;
  const slot = EquipmentSlot[slotKey];

  if (slot === undefined) {
    ctx.packetSender.sendError("Slot inválido.");
    Logger.warn(`[Unequip] Slot inválido recebido: ${msg.slot}`);
    return;
  }

  const success = player.unequipItem(slot);
  if (success) {
    ctx.packetSender.sendInventory(player);
    ctx.packetSender.sendPlayerStats(player);
    ctx.packetSender.sendEquipment(player);
    ctx.packetSender.sendUnequipResult(true, "Item desequipado.");
  } else {
    ctx.packetSender.sendUnequipResult(false, "Falha ao desequipar.");
  }
}

/**
 * Processa o drop de um item no chão.
 * Suporta tanto itens do inventário quanto itens equipados.
 */
export async function handleDropItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string; amount?: number; x: number; y: number },
  ctx: HandlerContext,
): Promise<void> {
  const { itemId, amount = 1, x, y } = msg;

  // 1. Verifica distância máxima (Manhattan 2 tiles)
  const dx = Math.abs(Math.floor(x) - Math.floor(player.position.x));
  const dy = Math.abs(Math.floor(y) - Math.floor(player.position.y));
  if (dx + dy > 2) {
    ctx.packetSender.sendDropError("Muito longe para dropar.");
    return;
  }

  // 2. Verifica se o jogador possui o item no inventário
  if (!player.hasItem(itemId, amount)) {
    // 2.1 Se não tiver no inventário, verifica se está equipado
    let equippedSlot: EquipmentSlot | null = null;
    for (const [slot, equippedItemId] of player.equipment.entries()) {
      if (equippedItemId === itemId) {
        equippedSlot = slot;
        break;
      }
    }

    if (equippedSlot !== null) {
      // Desequipa o item (move para o inventário)
      const unequipSuccess = player.unequipItem(equippedSlot);
      if (!unequipSuccess) {
        ctx.packetSender.sendDropError("Não foi possível desequipar o item.");
        return;
      }
      Logger.system(`${player.name} desequipou ${itemId} para dropar.`);
    } else {
      ctx.packetSender.sendDropError("Você não possui este item.");
      return;
    }
  }

  // 3. Remove do inventário (agora o item está no inventário)
  if (!player.removeItem(itemId, amount)) {
    ctx.packetSender.sendDropError("Erro ao remover o item.");
    return;
  }

  // 4. Busca o nome do item
  const itemDef = ItemRegistry.get(itemId);
  const itemName = itemDef?.name || itemId;

  // 5. Cria o item no chão
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

  // 6. Notifica todos os clientes sobre o novo item no chão
  ctx.wsServer.broadcastSpawnItemOnGround(itemOnGround);

  // 7. Envia inventário e equipamento atualizados
  ctx.packetSender.sendInventory(player);
  ctx.packetSender.sendEquipment(player);

  Logger.loot(`${player.name} dropou ${amount}x ${itemId} em (${Math.floor(x)}, ${Math.floor(y)})`);
}

/**
 * Processa o pickup de um item do chão.
 */
export async function handlePickupItem(
  ws: WebSocket,
  player: Player,
  msg: { itemId: string },
  ctx: HandlerContext,
): Promise<void> {
  Logger.system(`[Pickup] Recebido pickup para item ${msg.itemId}`);

  const itemOnGround = ctx.world.getItemOnGround(msg.itemId);
  if (!itemOnGround) {
    ctx.packetSender.sendPickupError("Item não encontrado no chão.");
    return;
  }

  // 1. Verifica distância máxima (Manhattan 2 tiles)
  const dx = Math.abs(itemOnGround.position.x - player.position.x);
  const dy = Math.abs(itemOnGround.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.sendPickupError("Muito longe para pegar.");
    return;
  }

  // 2. Adiciona ao inventário do jogador
  player.addItem(itemOnGround.itemId, itemOnGround.amount);

  // 3. Remove do mundo
  ctx.world.removeItemOnGround(itemOnGround);

  // 4. Notifica todos os clientes para remover o item visualmente
  ctx.wsServer.broadcastDespawn(itemOnGround.id);

  // 5. Envia inventário atualizado
  ctx.packetSender.sendInventory(player);

  Logger.loot(`${player.name} pegou ${itemOnGround.amount}x ${itemOnGround.itemId} do chão.`);
}
