/**
 * corpse.ts
 *
 * Representa um corpo de monstro morto que pode ser saqueado.
 * Contém o loot gerado e referência ao assassino.
 *
 * @module game/entities/Corpse
 */

import { Entity } from "./entity";
import { LootItem } from "../../shared/interfaces/loot.interface";

export class Corpse extends Entity {
  public loot: LootItem[];
  public killerId?: string; // golpe final
  /** Direito de autoloot: maior golpe efetivo, salvo no momento da morte. */
  public lootOwnerId?: string;

  /**
   * Cria um novo corpo.
   * @param id - Identificador único (timestamp ou UUID)
   * @param x - Posição X
   * @param y - Posição Y
   * @param loot - Lista de itens dropados
   * @param killerId - ID do jogador que matou o monstro (opcional, UUID)
   */
  constructor(id: string, x: number, y: number, loot: LootItem[], killerId?: string) {
    // O id do corpo pode continuar sendo number (timestamp) ou mudar para string. Mantenha number por simplicidade.
    super(id, "Corpse", x, y, "C");
    this.loot = loot;
    this.killerId = killerId;
  }
}
