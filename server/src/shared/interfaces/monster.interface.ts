/**
 * monster.interface.ts
 *
 * Definições de tipos para monstros (carregados de JSON).
 *
 * @module shared/interfaces/Monster
 */

import { DamageType } from "../enums/damageType.enum";

export interface MonsterLootEntry {
  itemId: string;
  chance: number;
  min?: number;
  max?: number;
}

export interface AttackEffect {
  /** ID da condição a ser aplicada (ex: "poison", "burn") */
  conditionId: string;
  /** Chance de aplicar o efeito (0 a 1) */
  chance: number;
  /** Duração do efeito em milissegundos (opcional, usa o padrão da condição) */
  duration?: number;
}

export interface MonsterType {
  id: string;
  name: string;
  level?: number;
  stats: {
    hp: number;
    speed?: number;
    /** Pontos de mana (opcional) */
    mana?: number;
  };
  combat: {
    xp: number;
    damageMin: number;
    damageMax: number;
    /** Tipo de dano do ataque básico (padrão "physical") */
    damageType?: DamageType;
    /** Efeito aplicado ao acertar (ex: veneno) */
    attackEffect?: AttackEffect;
  };
  /** Multiplicadores de dano recebido (ex: physical: 0.8 → sofre 20% menos dano físico) */
  resistances?: Partial<Record<DamageType, number>>;
  /** Multiplicadores de dano recebido (ex: fire: 1.2 → sofre 20% mais dano de fogo) */
  weaknesses?: Partial<Record<DamageType, number>>;
  loot?: MonsterLootEntry[];
  ai: {
    type: "aggressive" | "passive" | "flee";
    fleeHp?: number;
    attackCooldown?: number;
  };
  /** Flags de comportamento (hostil, atacável, vagueia) */
  flags?: {
    hostile?: boolean;
    attackable?: boolean;
    wander?: boolean;
  };
  visual: {
    symbol: string;
    /** Futuramente: spritesheet, animações, etc. */
  };
}
