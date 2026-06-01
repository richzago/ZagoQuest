import { EquipmentSlot } from "../enums/equipmentSlot.enum";

export interface EquipmentBonus {
  attack?: number;
  defense?: number;
  armor?: number;
  magicAttack?: number;
  magicDefense?: number;
  healthBonus?: number;
  manaBonus?: number;
  speed?: number;
  criticalChance?: number;
  criticalMultiplier?: number;
}

export interface EquipableItemType {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  bonuses: EquipmentBonus;
  value?: number;
  levelRequired?: number;
  vocationRequired?: string[];
}
