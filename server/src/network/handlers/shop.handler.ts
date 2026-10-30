/**
 * Handlers de loja: o cliente solicita, mas quem autoriza é o servidor.
 * O NPC precisa existir, ser comerciante e estar a <= 2 tiles do jogador.
 * Uma compra requer que a janela daquela loja tenha sido aberta antes.
 */
import type { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ShopSystem } from "../../game/systems/shopSystem";
import { NpcInteractionSystem } from "../../game/systems/npcInteractionSystem";
import { ItemRegistry } from "../../data/items/itemRegistry";
import type { ClientOpenShopMessage, ClientBuyItemMessage, ClientCloseShopMessage } from "../messages";

/** Um item antigo/experimental não deve derrubar a janela inteira. */
function itemDisplayName(itemId: string): string {
  try {
    return ItemRegistry.get(itemId).name;
  } catch {
    return itemId;
  }
}

/** Abre uma loja e registra a interação apenas depois de validar o catálogo. */
export async function handleOpenShop(
  _ws: WebSocket,
  player: Player,
  msg: ClientOpenShopMessage,
  ctx: HandlerContext,
): Promise<void> {
  // Compatibilidade com chamadas antigas por nome. A resposta sempre informa
  // o ID real da entidade, que será exigido no buyItem.
  const target = typeof msg.npcId === "string" ? msg.npcId.toLowerCase() : "";
  const npc = ctx.world.npcs.find(
    (candidate) => candidate.id === msg.npcId || candidate.name.toLowerCase() === target,
  );

  if (!npc || npc.npcType !== "merchant" || !npc.shopItems?.length ||
      !NpcInteractionSystem.open(player, ctx.world, npc, "merchant")) {
    // A tentativa inválida não pode conservar outra sessão econômica antiga.
    NpcInteractionSystem.close(player);
    ctx.packetSender.shop.sendShopError("Comerciante inválido, sem itens ou muito distante.");
    return;
  }

  const items = npc.shopItems.map((item) => ({
    itemId: item.itemId,
    name: itemDisplayName(item.itemId),
    price: item.buyPrice, // O preço vem do NPC do servidor, não do cliente.
    stock: item.stock ?? -1,
  }));

  ctx.packetSender.shop.sendShopWindow(npc.id, items);
  Logger.system(`Loja aberta para ${player.name} (NPC: ${npc.name}).`);
}

/** A compra verifica novamente a sessão, o NPC, a distância e o estoque. */
export async function handleBuyItem(
  _ws: WebSocket,
  player: Player,
  msg: ClientBuyItemMessage,
  ctx: HandlerContext,
): Promise<void> {
  const npc = NpcInteractionSystem.getActive(
    player, ctx.world, "merchant", msg.npcId,
  );
  if (!npc) {
    ctx.packetSender.shop.sendBuyResult(
      false, "Abra a loja próximo do comerciante antes de comprar.",
    );
    return;
  }

  const success = ShopSystem.buyItem(player, npc, msg.itemId, msg.amount);
  if (!success) {
    ctx.packetSender.shop.sendBuyResult(
      false, "Não foi possível comprar. Verifique gold, quantidade ou estoque.",
    );
    return;
  }

  ctx.packetSender.shop.sendBuyResult(
    true, `Comprou ${msg.amount}x ${itemDisplayName(msg.itemId)}.`,
  );
  ctx.packetSender.inventory.sendInventory(player);
  ctx.packetSender.inventory.sendPlayerStats(player);
  ctx.packetSender.inventory.sendGold(player);
}

/** Fecha somente a loja que originou esta mensagem. */
export function handleCloseShop(
  _ws: WebSocket,
  player: Player,
  msg: ClientCloseShopMessage,
  _ctx: HandlerContext,
): void {
  NpcInteractionSystem.closeIfActive(player, "merchant", msg.npcId);
}
