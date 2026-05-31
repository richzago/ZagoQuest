/**
 * Interface que define os atributos de combate de uma entidade.
 * Pode ser implementada por Creature (Player, Monster, Npc).
 */
export interface CombatStats {
  /** Poder de ataque (danho base antes da defesa do alvo) */
  attack: number;
  /** Defesa (reduz o danho recebido) */
  defense: number;
  /** Armadura (redução fixa adicional, tipo Tibia) */
  armor: number;
  /** Chance de crítico em percentual (0-100) */
  criticalChance: number;
  /** Multiplicador de danho crítico (ex: 1.5 = 50% mais dano) */
  criticalMultiplier: number;
}
