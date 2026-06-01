export interface FishingReward {
  itemId: string;
  minAmount: number;
  maxAmount: number;
  chance: number; // 0 a 1
  minSkillLevel?: number;
}
