/**
 * Configuração de uma skill (Sword, Fishing, etc.)
 */
export interface SkillConfig {
  name: string; // ex: "Sword Fighting"
  baseLevel: number; // nível inicial (1)
  baseProgress: number; // progresso atual (0 a 100)
  gainPerUse: number; // progresso ganho por uso (ex: 0.5)
  damageBonusPerLevel?: number; // +x% de dano por nível
  hitChanceBonusPerLevel?: number; // +x% de acerto (para distance)
  defenseBonusPerLevel?: number; // +x% de defesa (shielding)
  spellDamageBonusPerLevel?: number; // +x% de dano mágico (magicLevel)
}
