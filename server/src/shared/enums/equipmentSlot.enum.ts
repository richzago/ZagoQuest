/**
 * equipmentSlot.enum.ts
 *
 * Define os slots de equipamento disponíveis para o jogador.
 * Cada slot pode conter um item do tipo "equipment".
 *
 * @module shared/enums/EquipmentSlot
 */

export enum EquipmentSlot {
  /** Capacete / Elmo */
  HELMET = "helmet",

  /** Armadura / Peitoral */
  ARMOR = "armor",

  /** Pernas / Calças */
  LEGS = "legs",

  /** Botas */
  BOOTS = "boots",

  /** Arma (mão direita) */
  WEAPON = "weapon",

  /** Escudo (mão esquerda) */
  SHIELD = "shield",

  /** Amuleto (pescoço) */
  AMULET = "amulet",

  /** Anel (dedo) */
  RING = "ring",
}
