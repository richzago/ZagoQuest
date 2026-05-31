import { SkillType } from "../skills/skillTypes";

export interface PlayerSaveData {
  id: number;
  name: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  position: { x: number; y: number };
  inventory: Record<string, number>; // itemId -> quantidade
  skills: Record<SkillType, { level: number; progress: number }>;
  lastSaveTime: number;
}
