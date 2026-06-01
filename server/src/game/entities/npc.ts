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

  constructor(
    id: number,
    name: string,
    x: number,
    y: number,
    message: string,
    npcType: NpcType = "quest",
  ) {
    // Chama o construtor de Creature com símbolo 'N' (representação visual no renderizador ASCII)
    super(id, name, x, y, "N");

    this.message = message;
    this.npcType = npcType;

    // NPCs são imortais (não participam de combate), mas têm valores padrão
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
