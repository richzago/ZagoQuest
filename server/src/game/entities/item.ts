/**
 * item.ts
 *
 * Representa um item que está solto no chão (não no inventário).
 * Usado para drops temporários (ex: quando um monstro morre e dropa um item diretamente,
 * mas atualmente o sistema usa Corpse; este arquivo pode ser utilizado futuramente).
 *
 * @module game/entities/ItemEntity
 */

import { ItemType } from "../../shared/interfaces/item.interface";

export class ItemEntity {
  /** Identificador único do item no mundo */
  id: number;

  /** Tipo do item (contém nome, descrição, efeitos, etc.) */
  type: ItemType;

  /** Quantidade (para itens empilháveis, ex: moedas) */
  amount: number;

  /** Posição no mundo onde o item está */
  position: { x: number; y: number };

  /**
   * Cria um novo item no chão.
   *
   * @param id - Identificador único
   * @param type - Tipo do item
   * @param amount - Quantidade
   * @param x - Posição X
   * @param y - Posição Y
   *
   * @example
   * ```typescript
   * const gold = new ItemEntity(1001, goldCoinType, 50, 10, 10);
   * world.addItem(gold);
   * ```
   */
  constructor(id: number, type: ItemType, amount: number, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.amount = amount;
    this.position = { x, y };
  }
}
