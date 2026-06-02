/**
 * itemSystem.ts
 *
 * Gerencia itens no mundo (drop, coleta, empilhamento).
 * Utiliza o ItemRegistry para obter definições dos itens.
 *
 * @module game/entities/ItemSystem
 */

import { World } from "../world/World";
import { ItemEntity } from "../entities/item";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { Logger } from "../core/logger/logger";

export class ItemSystem {
  private nextId = 10000;

  constructor(private world: World) {}

  /**
   * Cria um item no chão, empilha se existir na mesma posição.
   *
   * @param itemId - ID do item (ex: "consumable/health_potion")
   * @param amount - Quantidade
   * @param x - Posição X
   * @param y - Posição Y
   * @returns {void}
   *
   * @remarks
   * Se o item for empilhável e já houver um item do mesmo tipo na posição,
   * a quantidade é adicionada ao item existente (respeitando o limite máximo).
   *
   * @example
   * ```typescript
   * itemSystem.dropItem("consumable/health_potion", 5, 10, 10);
   * ```
   */
  dropItem(itemId: string, amount: number, x: number, y: number): void {
    const type = ItemRegistry.get(itemId);
    if (!type) {
      Logger.error(`Item desconhecido: ${itemId}`);
      return;
    }

    // Tenta empilhar com item existente na posição
    const existing = this.world.getItemAt(x, y);
    if (existing && existing.type.id === itemId && existing.type.stackable) {
      const maxStack = existing.type.maxStack ?? 999;
      const newAmount = existing.amount + amount;
      if (newAmount <= maxStack) {
        existing.amount = newAmount;
        Logger.world(`Empilhado ${amount}x ${type.name} em (${x},${y})`);
        return;
      }
      // se ultrapassar, deixa o máximo e o resto como novo drop (lógica futura)
    }

    const item = new ItemEntity(this.nextId++, type, amount, x, y);
    this.world.addItem(item);
    Logger.world(`Drop: ${amount}x ${type.name} em (${x},${y})`);
  }

  /**
   * Remove um item do mundo (quando coletado).
   *
   * @param item - Item a ser removido
   * @returns {void}
   */
  removeItem(item: ItemEntity): void {
    this.world.removeItem(item);
  }
}
