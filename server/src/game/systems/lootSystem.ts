import { LootItem } from "../../shared/interfaces/loot.interface";
import { Logger } from "../core/logger/logger";
import { Monster } from "../entities/monster";

/**
 * Um item individual que o monstro pode dropar (antes de ir para o corpo).
 */

/**
 * Sistema de loot data-driven.
 * Apenas gera a lista de itens baseada no JSON do monstro.
 * Não insere nada no mundo – quem usa (DeathSystem) cria o Corpse.
 */
export class LootSystem {
  /**
   * Gera os itens que o monstro vai dropar.
   * @returns Lista de itens (vazia se não dropar nada)
   */
  static generateLoot(monster: Monster): LootItem[] {
    const lootTable = monster.type.loot;
    if (!lootTable || lootTable.length === 0) {
      Logger.loot(`🎁 ${monster.name} não tem loot definido.`);
      return [];
    }

    const drops: LootItem[] = [];

    for (const entry of lootTable) {
      // Sorteia entre 1 e 100000 (chance é um inteiro nessa faixa)
      const roll = Math.floor(Math.random() * 100000) + 1;
      if (roll > entry.chance) continue;

      const min = entry.min ?? 1;
      const max = entry.max ?? min;
      const amount = min + Math.floor(Math.random() * (max - min + 1));

      drops.push({ itemId: entry.itemId, amount });
    }

    if (drops.length === 0) {
      Logger.loot(`🎁 ${monster.name} não dropou nada.`);
    } else {
      const dropSummary = drops.map((d) => `${d.amount}x ${d.itemId}`).join(", ");
      Logger.loot(`🎁 ${monster.name} dropou: ${dropSummary}`);
    }

    return drops;
  }
}
