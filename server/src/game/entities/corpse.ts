/**
 * corpse.ts
 *
 * Representa o corpo de um monstro morto que fica no chão.
 * Contém os itens que o monstro dropou (loot).
 * O jogador pode saquear o corpo pressionando a tecla G (em área).
 *
 * @module game/entities/Corpse
 */

import { LootItem } from "../../shared/interfaces/loot.interface";

export class Corpse {
  /** Identificador único do corpo (geralmente timestamp) */
  id: number;

  /** Posição X no mundo (tile) */
  x: number;

  /** Posição Y no mundo (tile) */
  y: number;

  /** Lista de itens que o monstro dropou (cada item tem ID e quantidade) */
  loot: LootItem[];

  /** ID do jogador que matou o monstro (opcional, para futuras regras de saque exclusivo) */
  killerId?: number;

  /**
   * Cria um novo corpo.
   *
   * @param id - Identificador único
   * @param x - Posição X
   * @param y - Posição Y
   * @param loot - Itens dropados
   * @param killerId - ID do assassino (opcional)
   *
   * @example
   * ```typescript
   * const corpse = new Corpse(Date.now(), 5, 5, [{ itemId: "gold_coin", amount: 10 }]);
   * world.addCorpse(corpse);
   * ```
   */
  constructor(id: number, x: number, y: number, loot: LootItem[], killerId?: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.loot = loot;
    this.killerId = killerId;
  }
}
