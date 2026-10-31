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

export interface ItemType {
  id: string;
  name: string;
  description: string;
  type: "currency" | "consumable" | "equipment" | "quest" | "loot";
  stackable: boolean;
  maxStack?: number;
  /** Duração da regeneração periódica (em segundos), definida no JSON. */
  foodSeconds?: number;
  /** Pontos de saciedade por unidade (capacidade global: 120). */
  satietyPoints?: number;
  /** Efeito instantâneo de poções (a comida usa foodSeconds). */
  effect?: { healHp?: number; healMana?: number };
  value?: number;
  // Se for equipment, terá os campos de EquipableItemType
  slot?: EquipmentSlot;
  bonuses?: EquipmentBonus;
  levelRequired?: number;
  vocationRequired?: string[];
}
