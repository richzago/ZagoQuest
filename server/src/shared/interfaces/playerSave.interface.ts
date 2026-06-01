export interface SkillState {
  level: number;
  progress: number; // 0 a 100
}

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
  inventory: Record<string, number>;
  equipment: Record<string, string>;
  skills: Record<string, SkillState>;
  gold: number;
  bankGold: number;
}
