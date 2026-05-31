/**
 * IA baseada em regras + parâmetros.
 * Não é classe por monstro, é comportamento configurável.
 */
export interface MonsterAIConfig {
  fleeHp?: number; // se tiver isso → pode fugir
  attackCooldown?: number; // Tempo entre ataques em ms
}
