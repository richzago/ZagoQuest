/**
 * shop.handler.ts
 *
 * Handlers relacionados à loja de NPCs.
 *
 * @module network/handlers/shop
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ShopSystem } from "../../game/systems/shopSystem";
import { ItemRegistry } from "../../data/items/itemRegistry";
import type { ClientOpenShopMessage, ClientBuyItemMessage } from "../messages";

/**
 * Abre a janela da loja do NPC merchant.
 */
export async function handleOpenShop(
  ws: WebSocket,
  player: Player,
  msg: ClientOpenShopMessage,
  ctx: HandlerContext,
): Promise<void> {
  const npc = ctx.world.npcs.find(
    (n) => n.id === msg.npcId || n.name.toLowerCase() === msg.npcId.toLowerCase(),
  );
  if (!npc) {
    ctx.packetSender.shop.sendShopError("NPC não encontrado.");
    return;
  }

  if (npc.npcType !== "merchant") {
    ctx.packetSender.shop.sendShopError("NPC não é comerciante.");
    return;
  }

  if (!npc.shopItems || npc.shopItems.length === 0) {
    ctx.packetSender.shop.sendShopError("Comerciante não tem itens.");
    return;
  }

  const items = npc.shopItems.map((item) => ({
    itemId: item.itemId,
    name: ItemRegistry.get(item.itemId)?.name || item.itemId,
    price: item.buyPrice,
    stock: item.stock ?? -1,
  }));

  ctx.packetSender.shop.sendShopWindow(npc.id, items);
  Logger.system(`Loja aberta para ${player.name} (NPC: ${npc.name})`);
}

/**
 * Processa a compra de um item.
 */
export async function handleBuyItem(
  ws: WebSocket,
  player: Player,
  msg: ClientBuyItemMessage,
  ctx: HandlerContext,
): Promise<void> {
  const npc = ctx.world.npcs.find((n) => n.id === msg.npcId);
  if (!npc || npc.npcType !== "merchant") {
    ctx.packetSender.shop.sendBuyResult(false, "Comerciante inválido.");
    return;
  }

  const success = ShopSystem.buyItem(player, npc, msg.itemId, msg.amount);
  if (success) {
    ctx.packetSender.shop.sendBuyResult(
      true,
      `Comprou ${msg.amount}x ${ItemRegistry.get(msg.itemId)?.name || msg.itemId}.`,
    );
    ctx.packetSender.inventory.sendInventory(player);
    ctx.packetSender.inventory.sendPlayerStats(player);
    ctx.packetSender.inventory.sendGold(player);
  } else {
    ctx.packetSender.shop.sendBuyResult(
      false,
      "Não foi possível comprar. Verifique gold ou estoque.",
    );
  }
}
