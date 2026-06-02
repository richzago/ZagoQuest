/**
 * lootSystem.ts
 *
 * Geração de loot de monstros (itens dropados).
 * Apenas gera a lista de itens baseada no JSON do monstro.
 * Quem usa (DeathSystem) cria o Corpse com esses itens.
 *
 * @module game/systems/LootSystem
 */

import { Logger } from "../core/logger/logger";
import { Monster } from "../entities/monster";
import { LootItem } from "../../shared/interfaces/loot.interface";

/**
 * Classe estática responsável por gerar o loot de um monstro.
 *
 * @remarks
 * O loot é gerado a partir da tabela definida no arquivo JSON do monstro.
 * Cada entrada possui:
 * - `itemId`: identificador do item (ex: "currency/gold_coin")
 * - `chance`: número entre 1 e 100000 (quanto maior, maior a chance)
 * - `min` e `max`: faixa de quantidade (opcional, padrão 1)
 *
 * A função `generateLoot` não insere os itens no mundo; apenas retorna uma lista.
 * O `DeathSystem` posteriormente cria um `Corpse` com esses itens.
 *
 * @example
 * ```typescript
 * // No DeathSystem.handleMonsterDeath
 * const loot = LootSystem.generateLoot(monster);
 * const corpse = new Corpse(Date.now(), monster.position.x, monster.position.y, loot);
 * world.addCorpse(corpse);
 * ```
 */
export class LootSystem {
  /**
   * Gera os itens que o monstro vai dropar.
   *
   * @param monster - Monstro que morreu
   * @returns Lista de itens (vazia se não dropar nada)
   *
   * @remarks
   * A chance é baseada no campo `chance` do JSON. O algoritmo:
   * 1. Sorteia um número entre 1 e 100000.
   * 2. Se o número sorteado for menor ou igual à chance, o item é dropado.
   * 3. A quantidade é sorteada entre `min` e `max` (inclusive).
   *
   * Logs informativos são emitidos no canal `COMBAT` para depuração.
   *
   * @example
   * ```typescript
   * const loot = LootSystem.generateLoot(rat);
   * // Possível saída: loot = [{ itemId: "currency/gold_coin", amount: 3 }]
   * console.log(loot);
   * ```
   */
  static generateLoot(monster: Monster): LootItem[] {
    const lootTable = monster.type.loot;
    if (!lootTable || lootTable.length === 0) {
      Logger.combat(`🎁 ${monster.name} não tem loot definido.`);
      return [];
    }

    const drops: LootItem[] = [];

    for (const entry of lootTable) {
      const roll = Math.floor(Math.random() * 100000) + 1;
      if (roll > entry.chance) continue;

      const min = entry.min ?? 1;
      const max = entry.max ?? min;
      const amount = min + Math.floor(Math.random() * (max - min + 1));

      drops.push({ itemId: entry.itemId, amount });
    }

    if (drops.length === 0) {
      Logger.combat(`🎁 ${monster.name} não dropou nada.`);
    } else {
      const dropSummary = drops.map((d) => `${d.amount}x ${d.itemId}`).join(", ");
      Logger.combat(`🎁 ${monster.name} dropou: ${dropSummary}`);
    }

    return drops;
  }
}
