/**
 * npc.ts
 *
 * Representa um personagem não‑jogador (NPC) no mundo.
 * Pode ser do tipo:
 * - "quest" (apenas diálogo)
 * - "merchant" (vende/compara itens)
 * - "banker" (depósito/retirada de gold)
 * - "trainer" (futuro)
 *
 * Os dados são carregados de arquivos JSON em src/data/npc/.
 *
 * @module game/entities/Npc
 */

import { Creature } from "./creature";
import { NpcAI } from "../ai/npcAI";
import { ShopItem } from "../../shared/interfaces/npcShop.interface";
import { NpcType } from "../../shared/types/npc.type";

export class Npc extends Creature {
  /** Mensagem exibida ao interagir (ex: "Welcome! Buy something!") */
  message: string;

  /** Inteligência artificial (opcional) – usada para NPCs que andam (ex: Guide) */
  ai?: NpcAI;

  /** Tipo do NPC (merchant, banker, quest, trainer) */
  npcType: NpcType;

  /** Lista de itens que o comerciante vende/compra (apenas para npcType === "merchant") */
  shopItems?: ShopItem[];

  /** Saldo bancário (não usado no momento; o banco é global por jogador) */
  bankBalance?: number;

  /**
   * Cria um novo NPC.
   *
   * @param id - Identificador único
   * @param name - Nome do NPC
   * @param x - Posição X inicial
   * @param y - Posição Y inicial
   * @param message - Mensagem exibida ao interagir
   * @param npcType - Tipo do NPC (padrão "quest")
   *
   * @example
   * ```typescript
   * const merchant = new Npc(5, "Merchant", 12, 3, "Welcome!", "merchant");
   * merchant.shopItems = [{ itemId: "health_potion", buyPrice: 10, sellPrice: 5 }];
   * world.addNpc(merchant);
   * ```
   */
  constructor(
    id: number,
    name: string,
    x: number,
    y: number,
    message: string,
    npcType: NpcType = "quest",
  ) {
    super(id, name, x, y, "N");
    this.message = message;
    this.npcType = npcType;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.maxMana = 0;
    this.mana = 0;
    this.level = 1;
    this.experience = 0;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMana(): number {
    return 0;
  }
}
