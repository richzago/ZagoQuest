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
import { canDropOnWorldTile } from "../../game/systems/worldDropRules";
import type {
  ClientUseItemMessage,
  ClientOpenBagMessage,
  ClientCloseBagMessage,
  ClientEquipItemMessage,
  ClientUnequipItemMessage,
  ClientDropItemMessage,
  ClientPickupItemMessage,
} from "../messages";

/**
 * Janela de Bag aninhada: o servidor só permite abrir filho direto que
 * está no container atualmente visível. O cliente nunca escolhe UUID
 * arbitrário, nem pode abrir a Bag de outro personagem.
 */
export function handleOpenBag(
  _ws: WebSocket, player: Player, msg: ClientOpenBagMessage, ctx: HandlerContext,
): void {
  if (!player.openNestedBag(msg.itemId, msg.instanceId)) {
    ctx.packetSender.inventory.sendError("Não foi possível abrir esta Bag.");
    return;
  }
  ctx.packetSender.inventory.sendInventory(player);
}

export function handleCloseBag(
  _ws: WebSocket, player: Player, _msg: ClientCloseBagMessage, ctx: HandlerContext,
): void {
  if (!player.closeNestedBag()) return;
  ctx.packetSender.inventory.sendInventory(player);
}

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
      // Cada alimento define separadamente saciedade e o pequeno efeito
      // regenerativo em JSON. Validamos ANTES de retirar a unidade.
      const nowMs = Date.now();
      if (![item.satietyPoints, item.regenHpPerTick,
             item.regenManaPerTick, item.regenTickSeconds]
           .every((value) => Number.isSafeInteger(value))) {
        ctx.packetSender.inventory.sendItemUsed(itemId, false,
          "Alimento com configuração inválida.");
        return;
      }
      const foodConfig = [
        item.foodSeconds, nowMs, item.satietyPoints,
        item.regenHpPerTick, item.regenManaPerTick, item.regenTickSeconds,
      ] as const;
      if (!FoodRegenerationSystem.canEat(player, ...foodConfig)) {
        ctx.packetSender.inventory.sendItemUsed(itemId, false,
          "Você está de barriga cheia ou precisa esperar a saciedade diminuir.");
        return;
      }
      if (!player.removeItem(itemId, 1)) {
        ctx.packetSender.inventory.sendItemUsed(itemId, false,
          "Você não possui este alimento.");
        return;
      }
      FoodRegenerationSystem.feed(player, ...foodConfig);
      ctx.packetSender.inventory.sendItemUsed(itemId, true,
        `Você comeu ${item.name}. Saciedade: ${FoodRegenerationSystem.currentSatiety(player)}/120. ` +
        `Regeneração restante: ${FoodRegenerationSystem.remainingSeconds(player)}s.`);
      ctx.packetSender.inventory.sendInventory(player);
      ctx.packetSender.inventory.sendPlayerStats(player); // informa saciedade imediatamente
      // Nenhuma regeneração antecipada: os próximos ticks enviam stats reais.
      return;
    }

    let message = "";
    let effectApplied = false;

    // Contrato real dos JSONs: effect.healHp/healMana.
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

    // Poções são consumidas mesmo com HP/mana cheios (desperdício opcional
    // do jogador). Nenhum HP/mana acima do máximo, nenhuma mutação local.
    if (healAmount <= 0 && manaAmount <= 0) {
      ctx.packetSender.inventory.sendItemUsed(itemId, false, "Consumível sem efeito definido.");
      return;
    }
    if (!player.removeItem(itemId, 1)) {
      ctx.packetSender.inventory.sendItemUsed(itemId, false, "Item indisponível.");
      return;
    }
    if (!effectApplied) message = "Você usou " + item.name + ", mas seus atributos já estão cheios.";
    ctx.packetSender.inventory.sendItemUsed(itemId, true, message);
    ctx.packetSender.inventory.sendInventory(player);
    if (effectApplied) ctx.packetSender.inventory.sendPlayerStats(player);
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
  const success = player.equipItem(msg.itemId, msg.instanceId);
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
  if (!canDropOnWorldTile(ctx.world, player, tileX, tileY)) {
    ctx.packetSender.inventory.sendDropError("Tile bloqueado, fora da visão ou sem linha de visão.");
    return;
  }

  const equippedSlot = [...player.equipment.entries()]
    .find(([, equippedId]) => equippedId === itemId)?.[0];
  const fromEquipment = msg.fromEquipment === true ||
    // Compatibilidade com cliente antigo: só vem do equipamento se não
    // houver nenhuma unidade no inventário.
    (msg.fromEquipment === undefined &&
     !player.hasItem(itemId, amount) && amount === 1 && equippedSlot !== undefined);

  // Validar posse e ORIGEM antes de qualquer mutação.
  if (fromEquipment) {
    if (amount !== 1 || equippedSlot === undefined) {
      ctx.packetSender.inventory.sendDropError("Item não está no equipamento informado.");
      return;
    }
  } else if (!player.hasItem(itemId, amount)) {
    ctx.packetSender.inventory.sendDropError("Você não possui essa quantidade.");
    return;
  }

  let itemName = itemId;
  try { itemName = ItemRegistry.get(itemId).name; } catch { /* save legado */ }
  const onGround = new ItemOnGround(generateId(), itemId, amount, tileX, tileY, itemName);

  if (player.isContainerItem(itemId)) {
    if (amount !== 1) {
      ctx.packetSender.inventory.sendDropError("Cada Bag é uma instância: solte apenas uma.");
      return;
    }
    const payload = player.detachBagForGround(itemId, fromEquipment, msg.instanceId);
    if (!payload) {
      ctx.packetSender.inventory.sendDropError("Falha ao soltar esta Bag.");
      return;
    }
    // Guardar conteúdo no OBJETO do chão, nunca no inventário global.
    onGround.bagState = payload;
  } else if (fromEquipment) {
    player.equipment.delete(equippedSlot!);
    player.recalculateStats();
  } else if (!player.removeItem(itemId, amount)) {
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

  // Bootstrap: uma Bag ou Backpack no chão DEVE poder ser recuperada
  // mesmo sem outra equipada. Coleta e equipa diretamente (1 unidade),
  // sem exigir espaço em contêiner inexistente, mas sem ignorar alcance.
  let isGroundContainer = false;
  try {
    const item = ItemRegistry.get(onGround.itemId);
    isGroundContainer = item.type === "equipment" &&
      item.slot === EquipmentSlot.BACKPACK &&
      Number.isSafeInteger(item.containerSlots) && (item.containerSlots ?? 0) > 0;
  } catch { /* ID antigo não é bootstrap */ }
  const bootstrap = player.getContainerCapacity() === 0 &&
    !player.equipment.has(EquipmentSlot.BACKPACK) &&
    isGroundContainer && onGround.amount === 1;
  let accepted = false;
  if (bootstrap) {
    accepted = player.attachGroundBag(onGround.itemId, onGround.bagState, true);
  } else if (isGroundContainer && onGround.amount === 1) {
    accepted = player.canCollectItems([{itemId:onGround.itemId,amount:1}]) &&
      player.attachGroundBag(onGround.itemId, onGround.bagState, false);
  } else {
    accepted = player.canCollectItems([{itemId:onGround.itemId,amount:onGround.amount}]) &&
      player.addItem(onGround.itemId, onGround.amount);
  }
  if (!accepted) {
    const why = player.getContainerCapacity() <= 0
      ? "Equipe uma Bag/Backpack para pegar itens do chão."
      : "CAP insuficiente, Bag/Backpack cheia ou item inválido.";
    Logger.warn(`[SERVER LOG][PICKUP] ${player.name}: ${why}`);
    ctx.packetSender.inventory.sendPickupError(why);
    return;
  }

  ctx.world.removeItemOnGround(onGround);
  ctx.broadcast.broadcastDespawn(onGround.id);
  ctx.packetSender.inventory.sendInventory(player);
  if (bootstrap) ctx.packetSender.inventory.sendEquipment(player);
  Logger.loot(`${player.name} coletou ${onGround.amount}x ${onGround.itemId}.`);
}
