/**
 * Lista de todas as skills disponíveis no jogo.
 */
export enum SkillType {
  SWORD = "sword",
  AXE = "axe",
  CLUB = "club",
  DISTANCE = "distance",
  SHIELDING = "shielding",
  MAGIC_LEVEL = "magicLevel",
  FISHING = "fishing",
}

/**
 * Configuração de cada skill:
 * - baseProgress: experiência inicial (ex: 0)
 * - formula: exponencial ou linear? Usaremos fórmula similar ao Tibia:
 *   skillPercent = (level * level) * factor + constant
 */
export interface SkillConfig {
  name: string; // "Sword Fighting"
  baseLevel: number; // nível inicial (1)
  baseProgress: number; // progresso atual (0 a 100)
  // Fórmula para ganho de skill: cada uso dá X progresso (fixo ou variável)
  gainPerUse: number; // ex: 0.5 (meio ponto de progresso por ataque)
  // Efeitos no combate (para skills ofensivas)
  damageBonusPerLevel?: number; // +x% de dano por nível (ex: 0.02 = 2%)
  hitChanceBonusPerLevel?: number; // +x% de acerto (para distance)
  defenseBonusPerLevel?: number; // para shielding
  // Para magic level: afeta dano de magias (futuro)
  spellDamageBonusPerLevel?: number;
}
