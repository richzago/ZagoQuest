/**
 * item.ts
 *
 * Representa um item que está solto no chão (não no inventário).
 * Usado para drops temporários (ex: quando um monstro morre e dropa um item diretamente,
 * mas atualmente o sistema usa Corpse; este arquivo pode ser utilizado futuramente).
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

  constructor(id: number, type: ItemType, amount: number, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.amount = amount;
    this.position = { x, y };
  }
}
