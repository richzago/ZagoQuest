/**
 * promotionConfig.ts
 *
 * Configuração das promoções para cada vocação.
 *
 * @module data/promotions/PromotionConfig
 */

import { Vocation } from "../../shared/enums/vocation.enum";
import { VocationPromotions } from "../../shared/interfaces/promotion.interface";


export const PROMOTIONS_CONFIG: VocationPromotions[] = [
  {
    vocation: Vocation.KNIGHT,
    stages: [
      {
        stage: 0,
        requiredLevel: 12,
        bonus: { title: "Knight" },
      },
      {
        stage: 1,
        requiredLevel: 50,
        costGold: 50000,
        bonus: {
          title: "Elite Knight",
          hpPercentBonus: 0.1,
          defensePercentBonus: 0.05,
        },
      },
      {
        stage: 2,
        requiredLevel: 100,
        costGold: 100000,
        bonus: {
          title: "Champion Knight",
          hpPercentBonus: 0.15,
          armorPercentBonus: 0.1,
          attackPercentBonus: 0.05,
        },
      },
      {
        stage: 3,
        requiredLevel: 300,
        costGold: 500000,
        bonus: {
          title: "Warlord Knight",
          hpPercentBonus: 0.2,
          attackPercentBonus: 0.1,
        },
      },
      {
        stage: 4,
        requiredLevel: 500,
        costGold: 1000000,
        bonus: {
          title: "Titan Knight",
          hpPercentBonus: 0.3,
          armorPercentBonus: 0.15,
        },
      },
      {
        stage: 5,
        requiredLevel: 1000,
        costGold: 5000000,
        bonus: {
          title: "Eternal Guardian",
          hpPercentBonus: 0.5,
          defensePercentBonus: 0.2,
          attackPercentBonus: 0.15,
        },
      },
    ],
  },
  {
    vocation: Vocation.PALADIN,
    stages: [
      { stage: 0, requiredLevel: 12, bonus: { title: "Paladin" } },
      {
        stage: 1,
        requiredLevel: 50,
        costGold: 50000,
        bonus: { title: "Royal Paladin", hpPercentBonus: 0.1, attackPercentBonus: 0.1 },
      },
      {
        stage: 2,
        requiredLevel: 100,
        costGold: 100000,
        bonus: { title: "Ranger Lord", defensePercentBonus: 0.1, armorPercentBonus: 0.05 },
      },
      {
        stage: 3,
        requiredLevel: 300,
        costGold: 500000,
        bonus: { title: "Sentinel Hunter", attackPercentBonus: 0.15, criticalChanceBonus: 5 },
      },
      {
        stage: 4,
        requiredLevel: 500,
        costGold: 1000000,
        bonus: { title: "Phantom Ranger", hpPercentBonus: 0.2, defensePercentBonus: 0.15 },
      },
      {
        stage: 5,
        requiredLevel: 1000,
        costGold: 5000000,
        bonus: {
          title: "Celestial Marksman",
          attackPercentBonus: 0.25,
          criticalMultiplierBonus: 0.2,
        },
      },
    ],
  },
  {
    vocation: Vocation.DRUID,
    stages: [
      { stage: 0, requiredLevel: 12, bonus: { title: "Druid" } },
      {
        stage: 1,
        requiredLevel: 50,
        costGold: 50000,
        bonus: { title: "Elder Druid", manaPercentBonus: 0.1, magicDamagePercentBonus: 0.1 },
      },
      {
        stage: 2,
        requiredLevel: 100,
        costGold: 100000,
        bonus: { title: "Nature Sage", hpPercentBonus: 0.1, manaPercentBonus: 0.15 },
      },
      {
        stage: 3,
        requiredLevel: 300,
        costGold: 500000,
        bonus: { title: "High Druid", magicDamagePercentBonus: 0.2, manaPercentBonus: 0.2 },
      },
      {
        stage: 4,
        requiredLevel: 500,
        costGold: 1000000,
        bonus: { title: "Spirit Archdruid", hpPercentBonus: 0.2, defensePercentBonus: 0.1 },
      },
      {
        stage: 5,
        requiredLevel: 1000,
        costGold: 5000000,
        bonus: {
          title: "Ancient Worldshaper",
          magicDamagePercentBonus: 0.3,
          manaPercentBonus: 0.3,
        },
      },
    ],
  },
  {
    vocation: Vocation.SORCERER,
    stages: [
      { stage: 0, requiredLevel: 12, bonus: { title: "Sorcerer" } },
      {
        stage: 1,
        requiredLevel: 50,
        costGold: 50000,
        bonus: { title: "Master Sorcerer", manaPercentBonus: 0.15, magicDamagePercentBonus: 0.1 },
      },
      {
        stage: 2,
        requiredLevel: 100,
        costGold: 100000,
        bonus: { title: "Archmage", manaPercentBonus: 0.2, magicDamagePercentBonus: 0.15 },
      },
      {
        stage: 3,
        requiredLevel: 300,
        costGold: 500000,
        bonus: { title: "Grand Sorcerer", magicDamagePercentBonus: 0.25, manaPercentBonus: 0.25 },
      },
      {
        stage: 4,
        requiredLevel: 500,
        costGold: 1000000,
        bonus: { title: "Arcane Overlord", magicDamagePercentBonus: 0.3, criticalChanceBonus: 5 },
      },
      {
        stage: 5,
        requiredLevel: 1000,
        costGold: 5000000,
        bonus: {
          title: "Primordial Arcanist",
          magicDamagePercentBonus: 0.4,
          manaPercentBonus: 0.4,
        },
      },
    ],
  },
];
