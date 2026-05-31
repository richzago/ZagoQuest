import { CombatStats } from "../combat/combatStats";
import { Logger } from "../core/logger/logger";

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

/**
 * Fórmula de combate inspirada em Tibia.
 * - Dano base = atacante.attack - (defensor.defense + defensor.armor/2)
 * - Valor mínimo = 1 (sempre acerta pelo menos 1 de dano)
 * - Variação aleatória de ±20% no dano bruto antes do crítico.
 * - Chance de crítico baseada no atacante.criticalChance
 * - Crítico multiplica dano por atacante.criticalMultiplier
 */
export class CombatFormula {
  /**
   * Calcula o dano de um atacante contra um defensor.
   * Ambos devem implementar CombatStats.
   * @param attacker Entidade que ataca (must have attack, criticalChance, etc.)
   * @param defender Entidade que defende (must have defense, armor)
   * @returns Objeto com dano final e flag de crítico
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
