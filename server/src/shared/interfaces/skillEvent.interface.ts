import { SkillType } from "../enums/skillType.enum";

/**
 * Dados do evento de level up de skill.
 */
export interface SkillLevelUpEventData {
  playerId: number;
  playerName: string;
  skill: SkillType;
  oldLevel: number;
  newLevel: number;
  newProgress: number;
}
