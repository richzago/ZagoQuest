/**
 * Tipos de slots de equipamento.
 */
export enum EquipmentSlot {
  HELMET = "helmet",
  ARMOR = "armor",
  LEGS = "legs",
  BOOTS = "boots",
  WEAPON = "weapon",
  SHIELD = "shield",
  AMULET = "amulet",
  RING = "ring",
}

/**
 * Bônus que um item equipável pode fornecer.
 */
export interface EquipmentBonus {
  attack?: number; // bônus de ataque corpo a corpo
  defense?: number; // bônus de defesa (reduz chance de acerto? vamos usar como redução de dano físico)
  armor?: number; // redução fixa de dano (Tibia: armor reduz dano em até armor/2)
  magicAttack?: number; // bônus para magias (futuro)
  magicDefense?: number; // resistência mágica
  healthBonus?: number; // bônus de HP máximo
  manaBonus?: number; // bônus de mana máximo
  speed?: number; // velocidade de movimento
  criticalChance?: number; // chance de crítico (percentual, ex: 5 = 5%)
  criticalMultiplier?: number; // multiplicador do crítico (ex: 1.5 = 50% mais dano)
}

/**
 * Dados de um item equipável (a ser colocado no JSON).
 */
export interface EquipableItemType {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  bonuses: EquipmentBonus;
  value?: number;
  levelRequired?: number; // nível mínimo para equipar
  vocationRequired?: string[]; // futuramente
}
