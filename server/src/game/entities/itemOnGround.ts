/**
 * itemOnGround.ts
 *
 * Representa um item solto no chão que pode ser coletado por qualquer jogador.
 *
 * @module game/entities/ItemOnGround
 */

import { Entity } from "./entity";
import type { BagStateSave } from "./player";

/**
 * Item solto no mundo.
 */
export class ItemOnGround extends Entity {
  /** ID do item (ex: "consumable/health_potion") */
  public itemId: string;
  /** Quantidade de itens empilhados */
  public amount: number;
  /** Item Name (para exibição visual, opcional) */
  public itemName: string;
  /** Estado apenas do servidor: não enviar conteúdo privado em spawn broadcast. */
  public bagState?: BagStateSave;

  /**
   * Cria um novo item no chão.
   * @param id - Identificador único (UUID)
   * @param itemId - ID do item (ex: "equipment/armor/boneArmor")
   * @param amount - Quantidade
   * @param x - Posição X no mundo
   * @param y - Posição Y no mundo
   * @param itemName - Nome do item (para o cliente)
   */
  constructor(id: string, itemId: string, amount: number, x: number, y: number, itemName: string) {
    super(id, itemId, x, y);
    this.itemId = itemId;
    this.amount = amount;
    this.itemName = itemName;
  }
}
