/**
 * Atributos de combate de uma entidade (Player, Monster).
 */
export interface CombatStats {
  attack: number;
  defense: number;
  armor: number;
  criticalChance: number; // percentual (0-100)
  criticalMultiplier: number; // ex: 1.5 = 150% de dano
}

/**
 * Resultado de um cálculo de dano.
 */
export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

/**
 * Configuração da IA de um monstro (vem do JSON).
 * (Pode ser movido para monsterAI.interface.ts se preferir, mas mantemos aqui por enquanto)
 */
export interface MonsterAIConfig {
  fleeHp?: number; // HP abaixo do qual foge
  attackCooldown?: number; // tempo entre ataques (ms)
}
