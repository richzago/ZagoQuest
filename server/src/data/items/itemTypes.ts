import { EquipableItemType } from "../../game/entities/equipmentTypes";

export type ItemType = {
  id: string;
  name: string;
  description: string;
  type: "currency" | "consumable" | "equipment" | "quest" | "loot";
  stackable: boolean;
  maxStack?: number;
  value?: number;
} & Partial<EquipableItemType>; // se for equipment, terá os campos de EquipableItemType
