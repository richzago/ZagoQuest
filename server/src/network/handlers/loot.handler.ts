/**
 * loot.handler.ts
 *
 * Handlers relacionados ao loot de cadáveres.
 *
 * @module network/handlers/loot
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { generateId } from "../../shared/utils/idUtils";
import { canDropOnWorldTile } from "../../game/systems/worldDropRules";
import type { ClientDropCorpseLootMessage } from "../messages";
import type { ClientLootMessage, ClientTakeLootMessage } from "../messages";

/**
 * C15: Shift+L recolhe cada cadáver próprio na box 3x3 do jogador.
 * Apenas o maior hit EFETIVO registrado no momento da morte confere acesso.
 * O comando não recebe IDs de cadáveres do cliente: escopo apenas Node.
 */
export function handleAutoLootNearby(
  _ws: WebSocket, player: Player, _msg: {type:"autoLootNearby"}, ctx: HandlerContext,
): void {
  const x=Math.floor(player.position.x), y=Math.floor(player.position.y);
  const eligible=[...ctx.world.corpses].filter(c =>
    Math.abs(Math.floor(c.position.x)-x)<=1 &&
    Math.abs(Math.floor(c.position.y)-y)<=1 &&
    c.lootOwnerId === player.id);
  let collected=0, blocked=0;
  for (const corpse of eligible) {
    if (!player.canCollectItems(corpse.loot)) { blocked++; continue; }
    // Nenhum await entre validar o lote e transferir: atomicidade por corpo.
    for (const entry of corpse.loot) {
      player.addItem(entry.itemId,entry.amount);
      if (player.isContainerItem(entry.itemId))
        player.registerPurchasedBags(entry.itemId,entry.amount);
    }
    ctx.world.removeCorpse(corpse);
    ctx.broadcast.broadcastDespawn(corpse.id);
    ctx.packetSender.loot.sendLootTaken(corpse.id);
    collected++;
  }
  if (collected>0) ctx.packetSender.inventory.sendInventory(player);
  else ctx.packetSender.loot.sendLootError(blocked>0
    ? "CAP ou slots insuficientes para o loot automático."
    : "Nenhum cadáver elegível pelo maior hit na box 3x3.");
}

export async function handleLoot(
  ws: WebSocket,
  player: Player,
  msg: ClientLootMessage,
  ctx: HandlerContext,
): Promise<void> {
  const { corpseId } = msg;
  Logger.system(`[Loot] handleLoot chamado para corpse ${corpseId}`);

  const corpse = ctx.world.corpses.find((c) => c.id === corpseId);
  if (!corpse) {
    ctx.packetSender.loot.sendLootError("Corpse not found");
    return;
  }

  const dx = Math.abs(corpse.position.x - player.position.x);
  const dy = Math.abs(corpse.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.loot.sendLootError("Too far from corpse");
    return;
  }

  const items = corpse.loot.map((item) => ({
    itemId: item.itemId,
    amount: item.amount,
    itemName: ItemRegistry.get(item.itemId)?.name || item.itemId,
  }));

  ctx.packetSender.loot.sendLootWindow(corpse.id, items);
}

export async function handleTakeLoot(
  ws: WebSocket,
  player: Player,
  msg: ClientTakeLootMessage,
  ctx: HandlerContext,
): Promise<void> {
  const corpse = ctx.world.corpses.find((c) => c.id === msg.corpseId);
  if (!corpse) {
    ctx.packetSender.loot.sendLootError("Corpse not found");
    return;
  }

  const dx = Math.abs(corpse.position.x - player.position.x);
  const dy = Math.abs(corpse.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.loot.sendLootError("Too far from corpse");
    return;
  }

  if (msg.takeAll) {
    // Validar lote INTEIRO, para não consumir metade se a Bag encher.
    if (!player.canCollectItems(corpse.loot)) {
      const why = player.getContainerCapacity() <= 0
        ? "Equipe uma Bag ou Backpack para coletar loot."
        : "CAP insuficiente ou slots da Bag/Backpack ocupados.";
      Logger.warn(`[SERVER LOG][LOOT] ${player.name}: ${why}`);
      ctx.packetSender.loot.sendLootError(why);
      return;
    }

    // Nenhuma operação assíncrona entre validar e transferir os itens.
    for (const item of corpse.loot) {
      if (!player.addItem(item.itemId, item.amount)) {
        ctx.packetSender.loot.sendLootError("Falha ao adicionar item do loot.");
        return;
      }
      // Cada Bag gerada como loot precisa de identidade própria.
      if (player.isContainerItem(item.itemId))
        player.registerPurchasedBags(item.itemId, item.amount);
    }

    ctx.world.removeCorpse(corpse);
    ctx.broadcast.broadcastDespawn(corpse.id);
    ctx.packetSender.loot.sendLootTaken(corpse.id);
    ctx.packetSender.inventory.sendInventory(player);
    return;
  }

  // Índices de array também chegam do cliente e precisam ser inteiros válidos.
  if (!Number.isSafeInteger(msg.itemIndex) || msg.itemIndex! < 0) {
    ctx.packetSender.loot.sendLootError("Índice do loot inválido.");
    return;
  }

  const item = corpse.loot[msg.itemIndex!];
  if (!item || !player.canCollectItems([item]) ||
      !player.addItem(item.itemId, item.amount)) {
    const why = player.getContainerCapacity() <= 0
      ? "Equipe uma Bag ou Backpack antes de pegar itens."
      : "Item indisponível, CAP insuficiente ou sem slots na Bag/Backpack.";
    Logger.warn(`[SERVER LOG][LOOT] ${player.name}: ${why}`);
    ctx.packetSender.loot.sendLootError(why);
    return;
  }

  if (player.isContainerItem(item.itemId))
    player.registerPurchasedBags(item.itemId, item.amount);
  corpse.loot.splice(msg.itemIndex!, 1);
  if (corpse.loot.length === 0) {
    ctx.world.removeCorpse(corpse);
    ctx.broadcast.broadcastDespawn(corpse.id);
  }

  ctx.packetSender.loot.sendLootTaken(corpse.id, msg.itemIndex);
  ctx.packetSender.inventory.sendInventory(player);
}

/**
 * C9: arrastar item do cadáver para um tile do chão.
 * O Node valida posse contextual (cadáver ainda existe), índice atualizado,
 * alcance do personagem até ambos os pontos e bounds ANTES da mutação.
 * Não altera player.inventory nem exige Bag, logo não duplica itens.
 */
export async function handleDropCorpseLoot(
  _ws: WebSocket, player: Player, msg: ClientDropCorpseLootMessage,
  ctx: HandlerContext,
): Promise<void> {
  const corpse = ctx.world.corpses.find(c => c.id === msg.corpseId);
  if (!corpse) {
    ctx.packetSender.loot.sendLootError("Cadáver já não existe.");
    return;
  }
  const corpseDistance = Math.abs(corpse.position.x - player.position.x) +
    Math.abs(corpse.position.y - player.position.y);
  const x = msg.x, y = msg.y;
  if (corpseDistance > 2 || !canDropOnWorldTile(ctx.world, player, x, y)) {
    ctx.packetSender.loot.sendLootError("Cadáver distante ou destino fora da visão/bloqueado.");
    return;
  }
  if (!Number.isSafeInteger(msg.itemIndex) || msg.itemIndex < 0 ||
      msg.itemIndex >= corpse.loot.length) {
    ctx.packetSender.loot.sendLootError("Índice do loot desatualizado.");
    return;
  }
  const entry = corpse.loot[msg.itemIndex];
  if (!entry || !Number.isSafeInteger(entry.amount) || entry.amount <= 0) {
    ctx.packetSender.loot.sendLootError("Item inválido no cadáver.");
    return;
  }
  let itemName = entry.itemId;
  try { itemName = ItemRegistry.get(entry.itemId).name; }
  catch { /* Identificador legado sem nome: nunca perder o item */ }
  const ground = new ItemOnGround(generateId(), entry.itemId, entry.amount, x, y, itemName);

  // Sem await entre mutações: exatamente uma saída do cadáver e um spawn.
  ctx.world.addItemOnGround(ground);
  corpse.loot.splice(msg.itemIndex, 1);
  ctx.broadcast.broadcastSpawnItemOnGround(ground);
  if (corpse.loot.length === 0) {
    ctx.world.removeCorpse(corpse);
    ctx.broadcast.broadcastDespawn(corpse.id);
  }
  ctx.packetSender.loot.sendLootTaken(corpse.id, msg.itemIndex);
  Logger.loot(`[CORPSE→GROUND] ${player.name}: ${entry.amount}x ${entry.itemId} (${x},${y})`);
}
