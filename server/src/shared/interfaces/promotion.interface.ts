/**
 * promotion.interface.ts
 *
 * Interfaces para o sistema de promoções de vocação.
 *
 * @module shared/interfaces/Promotion
 */

import { Vocation } from "../enums/vocation.enum";

/**
 * Bônus concedido por uma promoção.
 */
export interface PromotionBonus {
  /** Título exibido (ex: "Elite Knight") */
  title: string;
  /** Bônus percentual de HP máximo (ex: 0.1 = +10%) */
  hpPercentBonus?: number;
  /** Bônus percentual de mana máxima (ex: 0.15 = +15%) */
  manaPercentBonus?: number;
  /** Bônus percentual de ataque físico (ex: 0.05 = +5%) */
  attackPercentBonus?: number;
  /** Bônus percentual de defesa (ex: 0.1 = +10%) */
  defensePercentBonus?: number;
  /** Bônus percentual de armadura (ex: 0.2 = +20%) */
  armorPercentBonus?: number;
  /** Bônus percentual de dano mágico (ex: 0.1 = +10%) */
  magicDamagePercentBonus?: number;
  /** Bônus de chance de acerto crítico (pontos percentuais, ex: 5 = +5%) */
  criticalChanceBonus?: number;
  /** Bônus de multiplicador de dano crítico (ex: 0.2 = +20% no multiplicador) */
  criticalMultiplierBonus?: number;
  /** Bônus percentual de velocidade de ataque (futuro) */
  attackSpeedPercentBonus?: number;
  /** Bônus percentual de velocidade de movimento (futuro) */
  movementSpeedPercentBonus?: number;
}

/**
 * Definição de um estágio de promoção.
 */
export interface PromotionStage {
  stage: number;
  requiredLevel: number;
  costGold?: number;
  bonus: PromotionBonus;
}

/**
 * Definição completa das promoções de uma vocação.
 */
export interface VocationPromotions {
  vocation: Vocation;
  stages: PromotionStage[];
}
