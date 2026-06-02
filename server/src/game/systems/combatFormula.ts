/**
 * combatFormula.ts
 *
 * Fórmula de combate inspirada em Tibia.
 * - Dano base = atacante.attack - (defensor.defense + defensor.armor/2)
 * - Valor mínimo = 1 (sempre acerta pelo menos 1 de dano)
 * - Variação aleatória de ±20% no dano bruto antes do crítico.
 * - Chance de crítico baseada no atacante.criticalChance
 * - Crítico multiplica dano por atacante.criticalMultiplier
 *
 * @module game/systems/CombatFormula
 */

import { CombatStats, DamageResult } from "../../shared/interfaces/combat.interface";
import { Logger } from "../core/logger/logger";

/**
 * Classe estática que contém a lógica de cálculo de dano do jogo.
 *
 * @remarks
 * A fórmula é inspirada em jogos clássicos como Tibia.
 * O dano final nunca é inferior a 1.
 *
 * @example
 * ```typescript
 * const result = CombatFormula.calculateDamage(attacker, defender);
 * console.log(`Dano: ${result.damage}, Crítico: ${result.isCritical}`);
 * ```
 */
export class CombatFormula {
  /**
   * Calcula o dano de um atacante contra um defensor.
   *
   * @param attacker - Entidade que ataca (deve implementar CombatStats: attack, criticalChance, criticalMultiplier)
   * @param defender - Entidade que defende (deve implementar CombatStats: defense, armor)
   * @returns Objeto com o dano final e um booleano indicando se foi um golpe crítico
   *
   * @remarks
   * O cálculo segue os seguintes passos:
   * 1. Dano base = `attacker.attack - (defender.defense + Math.floor(defender.armor / 2))`
   * 2. Garante que o dano base seja pelo menos 1.
   * 3. Aplica uma variação aleatória entre ±20% (fator entre 0.8 e 1.2).
   * 4. Verifica se ocorre um golpe crítico com base no `attacker.criticalChance`.
   * 5. Se crítico, multiplica o dano pelo `attacker.criticalMultiplier`.
   * 6. Garante que o dano final seja pelo menos 1.
   *
   * Um log é gerado no canal `COMBAT` quando ocorre um acerto crítico.
   *
   * @example
   * ```typescript
   * const attacker: CombatStats = { attack: 20, criticalChance: 10, criticalMultiplier: 1.5 };
   * const defender: CombatStats = { defense: 5, armor: 2 };
   * const result = CombatFormula.calculateDamage(attacker, defender);
   * // result.damage pode ser, por exemplo, 15, result.isCritical pode ser true
   * ```
   */
  static calculateDamage(attacker: CombatStats, defender: CombatStats): DamageResult {
    // Fórmula base: dano = ataque - (defesa + armadura/2)
    let rawDamage = attacker.attack - (defender.defense + Math.floor(defender.armor / 2));
    // Garante mínimo 1 de dano (Tibia sempre causa pelo menos 1)
    rawDamage = Math.max(1, rawDamage);

    // Aplica uma pequena variação aleatória (±20%) para não ficar previsível
    const variance = 0.8 + Math.random() * 0.4; // entre 0.8 e 1.2
    let finalDamage = Math.floor(rawDamage * variance);

    // Crítico
    let isCritical = false;
    const critChance = attacker.criticalChance;
    if (critChance > 0 && Math.random() * 100 < critChance) {
      const critMulti = attacker.criticalMultiplier;
      finalDamage = Math.floor(finalDamage * critMulti);
      isCritical = true;
    }

    // Garante que o dano final nunca seja menor que 1
    finalDamage = Math.max(1, finalDamage);

    if (isCritical) {
      Logger.combat(
        `⚡ Crítico! ${(attacker as any).name} causou ${finalDamage} de dano (${critChance}% chance)`,
      );
    }

    return { damage: finalDamage, isCritical };
  }
}
