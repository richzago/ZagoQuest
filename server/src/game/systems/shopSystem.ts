/**
 * shopSystem.ts
 *
 * Gerencia a compra e venda de itens entre o jogador e NPCs comerciantes.
 * A compra utiliza primeiro o gold em mãos (player.gold) e, se insuficiente,
 * complementa com o saldo bancário (player.bankGold).
 *
 * @module game/systems/ShopSystem
 */

import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { Logger } from "../core/logger/logger";

/**
 * Classe estática que contém as operações de compra e venda com NPCs comerciantes.
 *
 * @remarks
 * O sistema verifica estoque do NPC, valida se o jogador possui os itens ou gold necessário,
 * e registra todas as transações no canal `ECONOMY` do logger.
 * Para compras, o pagamento é feito primeiro com o gold em mãos; se insuficiente, utiliza o saldo bancário.
 *
 * @example
 * ```typescript
 * // Comprar uma poção (usando gold da mochila ou banco)
 * ShopSystem.buyItem(player, merchant, "consumable/health_potion", 1);
 *
 * // Vender um item
 * ShopSystem.sellItem(player, merchant, "consumable/health_potion", 1);
 *
 * // Listar itens do comerciante
 * ShopSystem.showShopItems(player, merchant);
 * ```
 */
export class ShopSystem {
  /**
   * Compra um item do NPC.
   * O pagamento é feito primeiro com o gold da mochila; se faltar,
   * o restante é descontado do saldo bancário.
   *
   * @param player - Jogador que está comprando
   * @param npc - NPC comerciante
   * @param itemId - ID do item a ser comprado (ex: "consumable/health_potion")
   * @param quantity - Quantidade (padrão 1)
   * @returns `true` se a compra foi bem-sucedida, `false` caso contrário
   *
   * @remarks
   * Validações realizadas:
   * - NPC deve ter itens à venda.
   * - Item deve existir na lista do comerciante.
   * - Jogador deve ter fundos totais (mochila + banco) suficientes.
   * - Estoque do NPC (se definido) deve ser suficiente.
   *
   * O pagamento é descontado primeiro do gold em mãos e, se necessário, do saldo bancário.
   * Após a compra, o item é adicionado ao inventário e o estoque do NPC é reduzido.
   * Um log detalhado é registrado no canal `ECONOMY`.
   *
   * @example
   * ```typescript
   * const success = ShopSystem.buyItem(player, merchant, "consumable/health_potion", 2);
   * if (success) console.log("Compra realizada!");
   * ```
   */
  static buyItem(player: Player, npc: Npc, itemId: string, quantity: number = 1): boolean {
    // Verifica se o NPC vende itens
    if (!npc.shopItems) {
      Logger.warn(`${npc.name} não vende itens.`);
      return false;
    }

    // Encontra o item na lista do comerciante
    const shopItem = npc.shopItems.find((i) => i.itemId === itemId);
    if (!shopItem) {
      Logger.warn(`${npc.name} não vende ${itemId}.`);
      return false;
    }

    const totalCost = shopItem.buyPrice * quantity;
    const totalGoldAvailable = player.gold + player.bankGold;

    // Verifica se o jogador tem fundos totais (mochila + banco) suficientes
    if (totalGoldAvailable < totalCost) {
      Logger.warn(
        `Você precisa de ${totalCost} gold para comprar ${quantity}x ${itemId}. ` +
          `Você tem ${player.gold} na mochila e ${player.bankGold} no banco.`,
      );
      return false;
    }

    // Verifica estoque do NPC (se definido)
    if (shopItem.stock !== undefined && shopItem.stock < quantity) {
      Logger.warn(`${npc.name} não tem estoque suficiente de ${itemId}.`);
      return false;
    }

    // --- Processa o pagamento: primeiro usa o gold da mochila, depois o banco ---
    let remainingCost = totalCost;
    const fromPouch = Math.min(player.gold, remainingCost);
    player.gold -= fromPouch;
    remainingCost -= fromPouch;

    if (remainingCost > 0) {
      player.bankGold -= remainingCost;
      Logger.economy(
        `Usado ${remainingCost} gold do banco para completar a compra. Saldo bancário restante: ${player.bankGold}`,
      );
    }

    // Adiciona o item ao inventário do jogador
    player.addItem(itemId, quantity);

    // Atualiza o estoque do NPC, se houver controle
    if (shopItem.stock !== undefined) shopItem.stock -= quantity;

    // Log da transação
    Logger.economy(
      `${player.name} comprou ${quantity}x ${itemId} por ${totalCost} gold ` +
        `(mochila: ${fromPouch}, banco: ${totalCost - fromPouch}).`,
    );
    return true;
  }

  /**
   * Vende um item para o NPC.
   * O valor é adicionado diretamente ao gold em mãos do jogador.
   *
   * @param player - Jogador que está vendendo
   * @param npc - NPC comerciante
   * @param itemId - ID do item a ser vendido
   * @param quantity - Quantidade (padrão 1)
   * @returns `true` se a venda foi bem-sucedida, `false` caso contrário
   *
   * @remarks
   * Validações:
   * - NPC deve comprar itens.
   * - Item deve existir na lista do comerciante.
   * - Jogador deve ter a quantidade necessária no inventário.
   *
   * O gold é adicionado diretamente ao `player.gold` (não ao banco).
   * Um log da transação é registrado no canal `ECONOMY`.
   *
   * @example
   * ```typescript
   * const success = ShopSystem.sellItem(player, merchant, "consumable/health_potion", 1);
   * if (success) console.log("Venda realizada!");
   * ```
   */
  static sellItem(player: Player, npc: Npc, itemId: string, quantity: number = 1): boolean {
    // Verifica se o NPC compra itens
    if (!npc.shopItems) {
      Logger.warn(`${npc.name} não compra itens.`);
      return false;
    }

    // Encontra o item na lista do comerciante
    const shopItem = npc.shopItems.find((i) => i.itemId === itemId);
    if (!shopItem) {
      Logger.warn(`${npc.name} não compra ${itemId}.`);
      return false;
    }

    // Verifica se o jogador possui a quantidade necessária
    if (!player.hasItem(itemId, quantity)) {
      Logger.warn(`Você não tem ${quantity}x ${itemId} para vender.`);
      return false;
    }

    const totalEarn = shopItem.sellPrice * quantity;

    // Remove o item do inventário e adiciona o gold
    player.removeItem(itemId, quantity);
    player.gold += totalEarn;

    Logger.economy(`${player.name} vendeu ${quantity}x ${itemId} por ${totalEarn} gold.`);
    return true;
  }

  /**
   * Exibe a lista de itens que o comerciante vende/compra.
   * Usado para debug e para o menu textual.
   *
   * @param player - Jogador (não utilizado diretamente, mas mantido para consistência)
   * @param npc - NPC comerciante
   * @returns {void}
   *
   * @remarks
   * A função exibe no log (canal `ECONOMY`) o nome do item, ID, preço de compra e preço de venda.
   * Útil para depuração e para o sistema de menus interativos.
   *
   * @example
   * ```typescript
   * // Mostrar itens do comerciante
   * ShopSystem.showShopItems(player, merchant);
   * ```
   */
  static showShopItems(player: Player, npc: Npc): void {
    if (!npc.shopItems || npc.shopItems.length === 0) {
      Logger.warn(`${npc.name} não tem itens para vender.`);
      return;
    }
    Logger.economy(`--- ${npc.name} - Itens à venda ---`);
    for (const item of npc.shopItems) {
      const itemData = ItemRegistry.get(item.itemId);
      const name = itemData?.name || item.itemId;
      Logger.economy(
        `${name} (${item.itemId}) | Compra: ${item.buyPrice}g | Venda: ${item.sellPrice}g`,
      );
    }
  }
}
