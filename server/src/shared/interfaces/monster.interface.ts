export interface MonsterLootEntry {
  itemId: string;
  chance: number;
  min?: number;
  max?: number;
}

export interface MonsterType {
  id: string;
  name: string;
  level?: number;
  stats: {
    hp: number;
    speed?: number;
  };
  combat: {
    xp: number;
    damageMin: number;
    damageMax: number;
  };
  loot?: MonsterLootEntry[];
  ai: {
    type: "aggressive" | "passive" | "flee";
    fleeHp?: number;
    attackCooldown?: number;
  };
  visual: {
    symbol: string;
  };
}
