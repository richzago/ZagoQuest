import { SkillType } from "../enums/skillType.enum";

export interface SkillConfig {
  name: string;
  baseLevel: number;
  baseProgress: number;
  gainPerUse: number;
  damageBonusPerLevel?: number;
  hitChanceBonusPerLevel?: number;
  defenseBonusPerLevel?: number;
  spellDamageBonusPerLevel?: number;
}

export interface SkillLevelUpEventData {
  playerId: number;
  playerName: string;
  skill: SkillType;
  oldLevel: number;
  newLevel: number;
  newProgress: number;
}
