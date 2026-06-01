/**
 * Configuração da IA de um monstro (vem do JSON).
 */
export interface MonsterAIConfig {
  fleeHp?: number; // HP abaixo do qual foge
  attackCooldown?: number; // tempo entre ataques (ms)
}
