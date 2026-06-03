/**
 * condition.interface.ts
 *
 * Interfaces para definição de condições (efeitos) carregadas de JSON.
 *
 * @module shared/interfaces/Condition
 */

import { DamageType } from "../enums/damageType.enum";

export type ConditionEffectType = "damage_over_time" | "stat_modifier" | "stun" | "haste" | "slow";

export interface ConditionEffect {
  type: ConditionEffectType;
  /** Para damage_over_time: damageType, amount, tickInterval (ms) */
  damageType?: DamageType;
  amount?: number;
  tickInterval?: number;
  /** Para stat_modifier: stat (ex: "attack", "defense", "speed"), modifier (ex: 0.2 = +20%) */
  stat?: string;
  modifier?: number;
}

export interface ConditionDefinition {
  id: string; // ex: "poison", "burn", "stun", "haste"
  name: string;
  description: string;
  icon?: string; // futuro
  defaultDuration: number; // ms
  effects: ConditionEffect[];
}
