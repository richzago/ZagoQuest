import { SkillType } from "../enums/skillType.enum";

/**
 * Estado de uma skill do jogador (nível e progresso).
 */
export interface SkillState {
  level: number;
  progress: number; // 0 a 100
}
