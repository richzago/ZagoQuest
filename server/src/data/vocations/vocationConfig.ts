/**
 * vocationConfig.ts
 *
 * Configurações de bônus de atributos por vocação.
 *
 * @module data/vocations/VocationConfig
 */

import { Vocation } from "../../shared/enums/vocation.enum";

export interface VocationBonus {
  hpPerLevel: number; // HP adicional por nível
  manaPerLevel: number; // Mana adicional por nível
  baseHp: number; // HP base (nível 1)
  baseMana: number; // Mana base (nível 1)
  // Futuro: damageBonus, defenseBonus, etc.
}

export const VocationConfigs: Record<Vocation, VocationBonus> = {
  [Vocation.NONE]: { hpPerLevel: 0, manaPerLevel: 0, baseHp: 100, baseMana: 50 },
  [Vocation.KNIGHT]: { hpPerLevel: 15, manaPerLevel: 2, baseHp: 150, baseMana: 40 },
  [Vocation.PALADIN]: { hpPerLevel: 10, manaPerLevel: 5, baseHp: 120, baseMana: 60 },
  [Vocation.DRUID]: { hpPerLevel: 5, manaPerLevel: 10, baseHp: 100, baseMana: 80 },
  [Vocation.SORCERER]: { hpPerLevel: 4, manaPerLevel: 12, baseHp: 90, baseMana: 100 },
};
