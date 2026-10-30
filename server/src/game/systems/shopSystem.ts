/**
 * Loja NPC: o servidor valida a transação antes de alterar inventário/estouque.
 * O preço e estoque vêm do NPC, nunca do pacote enviado pelo cliente.
 */
import type { Player } from "../entities/player";
import type { Npc } from "../entities/npc";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { Logger } from "../core/logger/logger";
import {
  canCreditGold, isValidGoldBalance, isValidItemId, isValidQuantity,
} from "./economyRules";

export class ShopSystem {
  /** Compra usando a carteira primeiro; complementa com o banco. */
  static buyItem(player: Player, npc: Npc, itemId: string, quantity: number): boolean {
    if (!isValidItemId(itemId) || !isValidQuantity(quantity)) return false;
    const item = npc.shopItems?.find((entry) => entry.itemId === itemId);
    if (!item || !Number.isSafeInteger(item.buyPrice) || item.buyPrice < 0 ||
        !isValidGoldBalance(player.gold) || !isValidGoldBalance(player.bankGold) ||
        !player.canAddItem(itemId, quantity)) return false;

    // Multiplicação pode gerar Infinity ou um inteiro impreciso.
    const cost = item.buyPrice * quantity;
    if (!Number.isSafeInteger(cost) || cost > player.gold + player.bankGold) return false;
    if (item.stock !== undefined &&
        (!Number.isSafeInteger(item.stock) || item.stock < quantity)) return false;

    const walletCost = Math.min(player.gold, cost);
    const bankCost = cost - walletCost;
    player.gold -= walletCost;
    player.bankGold -= bankCost;

    // Preserva o dinheiro se, por qualquer motivo, a inserção não se completar.
    if (!player.addItem(itemId, quantity)) {
      player.gold += walletCost;
      player.bankGold += bankCost;
      return false;
    }

    if (item.stock !== undefined) item.stock -= quantity;
    Logger.economy(`${player.name} comprou ${quantity}x ${itemId} por ${cost} gold.`);
    return true;
  }

  /** Venda concede gold somente após a remoção real do inventário. */
  static sellItem(player: Player, npc: Npc, itemId: string, quantity: number): boolean {
    if (!isValidItemId(itemId) || !isValidQuantity(quantity)) return false;
    const item = npc.shopItems?.find((entry) => entry.itemId === itemId);
    if (!item || !Number.isSafeInteger(item.sellPrice) || item.sellPrice < 0 ||
        !player.hasItem(itemId, quantity)) return false;

    const earned = item.sellPrice * quantity;
    if (!Number.isSafeInteger(earned) || !canCreditGold(player.gold, earned)) return false;
    if (!player.removeItem(itemId, quantity)) return false;

    // 0 gold é permitido em itens sem valor de revenda.
    if (earned > 0 && !player.addGold(earned)) {
      player.addItem(itemId, quantity);
      return false;
    }

    Logger.economy(`${player.name} vendeu ${quantity}x ${itemId} por ${earned} gold.`);
    return true;
  }

  static showShopItems(_player: Player, npc: Npc): void {
    for (const item of npc.shopItems ?? []) {
      // Alguns itens de desenvolvimento podem não estar no registro.
      let name = item.itemId;
      try { name = ItemRegistry.get(item.itemId).name; } catch { /* ID desconhecido */ }
      Logger.economy(`${name}: compra ${item.buyPrice}g; venda ${item.sellPrice}g.`);
    }
  }
}
