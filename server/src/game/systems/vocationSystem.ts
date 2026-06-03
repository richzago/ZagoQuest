/**
 * vocationSystem.ts
 *
 * Gerencia as vocações e promoções dos personagens.
 *
 * @module game/systems/VocationSystem
 */

import { Player } from "../entities/player";
import { Vocation } from "../../shared/enums/vocation.enum";
import { VocationConfigs } from "../../data/vocations/vocationConfig";
import { PromotionBonus } from "../../shared/interfaces/promotion.interface";
import { Logger } from "../core/logger/logger";
import { PROMOTIONS_CONFIG } from "../../data/promotions/promotionConfig";

export class VocationSystem {
  /**
   * Retorna o bônus de HP máximo baseado na vocação e nível.
   */
  static getMaxHpBonus(vocation: Vocation, level: number): number {
    const config = VocationConfigs[vocation] || VocationConfigs[Vocation.NONE];
    return config.baseHp + (level - 1) * config.hpPerLevel;
  }

  /**
   * Retorna o bônus de mana máxima baseado na vocação e nível.
   */
  static getMaxManaBonus(vocation: Vocation, level: number): number {
    const config = VocationConfigs[vocation] || VocationConfigs[Vocation.NONE];
    return config.baseMana + (level - 1) * config.manaPerLevel;
  }

  /**
   * Retorna o título da vocação/promoção baseado na vocação e estágio atual.
   */
  static getTitle(vocation: Vocation, promotionStage: number): string {
    const config = PROMOTIONS_CONFIG.find((p) => p.vocation === vocation);
    if (!config) return "Unknown";
    const stage = config.stages.find((s) => s.stage === promotionStage);
    return stage?.bonus.title || config.stages[0]?.bonus.title || "Unknown";
  }

  /**
   * Retorna os bônus acumulados de todas as promoções já adquiridas (até o estágio atual).
   */
  static getAccumulatedPromotionBonuses(
    vocation: Vocation,
    promotionStage: number,
  ): PromotionBonus {
    const config = PROMOTIONS_CONFIG.find((p) => p.vocation === vocation);
    if (!config || promotionStage <= 0) return { title: "" };

    const accumulated: PromotionBonus = { title: "" };
    for (let stage = 1; stage <= promotionStage; stage++) {
      const stageData = config.stages.find((s) => s.stage === stage);
      if (stageData && stageData.bonus) {
        accumulated.hpPercentBonus =
          (accumulated.hpPercentBonus || 0) + (stageData.bonus.hpPercentBonus || 0);
        accumulated.manaPercentBonus =
          (accumulated.manaPercentBonus || 0) + (stageData.bonus.manaPercentBonus || 0);
        accumulated.attackPercentBonus =
          (accumulated.attackPercentBonus || 0) + (stageData.bonus.attackPercentBonus || 0);
        accumulated.defensePercentBonus =
          (accumulated.defensePercentBonus || 0) + (stageData.bonus.defensePercentBonus || 0);
        accumulated.armorPercentBonus =
          (accumulated.armorPercentBonus || 0) + (stageData.bonus.armorPercentBonus || 0);
        accumulated.magicDamagePercentBonus =
          (accumulated.magicDamagePercentBonus || 0) +
          (stageData.bonus.magicDamagePercentBonus || 0);
        accumulated.criticalChanceBonus =
          (accumulated.criticalChanceBonus || 0) + (stageData.bonus.criticalChanceBonus || 0);
        accumulated.criticalMultiplierBonus =
          (accumulated.criticalMultiplierBonus || 0) +
          (stageData.bonus.criticalMultiplierBonus || 0);
        accumulated.title = stageData.bonus.title;
      }
    }
    return accumulated;
  }

  /**
   * Aplica os bônus de vocação e promoções ao jogador.
   * Deve ser chamado após mudar de vocação, nível ou promoção.
   */
  static applyVocationBonuses(player: Player): void {
    const vocation = player.vocation as Vocation;
    const baseHp = this.getMaxHpBonus(vocation, player.level);
    const baseMana = this.getMaxManaBonus(vocation, player.level);
    const promoBonus = this.getAccumulatedPromotionBonuses(vocation, player.promotionStage);

    let finalMaxHp = baseHp;
    let finalMaxMana = baseMana;
    if (promoBonus.hpPercentBonus)
      finalMaxHp = Math.floor(finalMaxHp * (1 + promoBonus.hpPercentBonus));
    if (promoBonus.manaPercentBonus)
      finalMaxMana = Math.floor(finalMaxMana * (1 + promoBonus.manaPercentBonus));
    player.maxHp = finalMaxHp;
    player.maxMana = finalMaxMana;
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    if (player.mana > player.maxMana) player.mana = player.maxMana;

    // Aplica bônus percentuais de ataque/defesa/armadura
    if (promoBonus.attackPercentBonus)
      player.attack = Math.floor(player.attack * (1 + promoBonus.attackPercentBonus));
    if (promoBonus.defensePercentBonus)
      player.defense = Math.floor(player.defense * (1 + promoBonus.defensePercentBonus));
    if (promoBonus.armorPercentBonus)
      player.armor = Math.floor(player.armor * (1 + promoBonus.armorPercentBonus));

    // Aplica bônus de crítico (chance e multiplicador)
    if (promoBonus.criticalChanceBonus) {
      player.criticalChance = Math.min(100, player.criticalChance + promoBonus.criticalChanceBonus);
    }
    if (promoBonus.criticalMultiplierBonus) {
      player.criticalMultiplier = player.criticalMultiplier + promoBonus.criticalMultiplierBonus;
    }
  }

  /**
   * Tenta promover o jogador para o próximo estágio (se atender aos requisitos).
   * @param player - Jogador
   * @returns true se promovido, false caso contrário
   */
  static async promote(player: Player): Promise<boolean> {
    const vocation = player.vocation as Vocation;
    const config = PROMOTIONS_CONFIG.find((p) => p.vocation === vocation);
    if (!config) {
      Logger.warn("Vocação não possui promoções configuradas.");
      return false;
    }

    const nextStage = player.promotionStage + 1;
    const stageData = config.stages.find((s) => s.stage === nextStage);
    if (!stageData) {
      Logger.warn("Você já atingiu o nível máximo de promoção.");
      return false;
    }

    if (player.level < stageData.requiredLevel) {
      Logger.warn(`Nível ${stageData.requiredLevel} necessário para a próxima promoção.`);
      return false;
    }

    if (stageData.costGold && player.gold < stageData.costGold) {
      Logger.warn(`Você precisa de ${stageData.costGold} gold para esta promoção.`);
      return false;
    }

    // Desconta o gold
    if (stageData.costGold) {
      player.gold -= stageData.costGold;
    }

    // Aumenta o estágio de promoção
    player.promotionStage = nextStage;
    player.recalculateStats(); // recalcula atributos com novos bônus

    const newTitle = this.getTitle(vocation, nextStage);
    Logger.system(`${player.name} foi promovido a ${newTitle}!`);
    return true;
  }
}
