/**
 * skillSystem.ts
 *
 * Gerencia a progressão de habilidades (skills) do jogador.
 * Cada skill tem um nível e um progresso (0 a 100). Quando o progresso atinge 100, a skill sobe de nível.
 * As skills concedem bônus de dano, defesa ou acerto dependendo do tipo.
 *
 * @module game/systems/SkillSystem
 */

import { Player } from "../entities/player";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { EventSystem } from "../core/events/eventSystem";
import { Logger } from "../core/logger/logger";
import { SkillType } from "../../shared/enums/skillType.enum";
import { SkillLevelUpEventData } from "../../shared/interfaces/skill.interface";

/**
 * Classe estática que contém a lógica de progressão e bônus das skills.
 *
 * @remarks
 * Cada skill possui um nível inicial e uma taxa de progresso por uso (gainPerUse),
 * definidos em `SkillConfigs`. Quando o progresso acumulado atinge 100, o nível aumenta
 * e o progresso é reduzido em 100 (sobrando o excesso para o próximo nível).
 *
 * Eventos de level up são emitidos via `EventSystem` para que outros sistemas (ex.: UI, conquistas) possam reagir.
 * Os bônus são lineares por nível: `1 + (nível - 1) * bônusPorNível`.
 *
 * @example
 * ```typescript
 * // Adicionar progresso à skill de espada
 * SkillSystem.addProgress(player, SkillType.SWORD, 0.5);
 *
 * // Obter bônus de dano para a skill de espada
 * const damageBonus = SkillSystem.getDamageBonus(player, SkillType.SWORD);
 * ```
 */
export class SkillSystem {
  /**
   * Adiciona progresso a uma skill do jogador.
   * Se acumular 100 ou mais, sobe de nível e reduz progresso.
   *
   * @param player - Jogador que terá a skill alterada
   * @param skill - Tipo da skill (ex.: `SkillType.SWORD`)
   * @param amount - Quantidade de progresso (geralmente `gainPerUse` da configuração)
   * @returns {void}
   *
   * @remarks
   * O progresso é acumulado. Se ultrapassar 100, múltiplos níveis podem ser ganhos de uma só vez.
   * Um evento `skill:levelUp` é emitido para cada nível subido, e um log é gerado no canal `SYSTEM`.
   * O progresso restante (após subtrair 100 por nível) é mantido.
   *
   * @example
   * ```typescript
   * // Ganhar 0.5 de progresso em espada
   * SkillSystem.addProgress(player, SkillType.SWORD, 0.5);
   * ```
   */
  static addProgress(player: Player, skill: SkillType, amount: number): void {
    const current = player.skills.get(skill);
    if (!current) return;

    let { level, progress } = current;
    progress += amount;

    let leveledUp = false;
    while (progress >= 100) {
      progress -= 100;
      level++;
      leveledUp = true;
    }

    player.skills.set(skill, { level, progress });

    if (leveledUp) {
      EventSystem.getInstance().emit<SkillLevelUpEventData>("skill:levelUp", {
        playerId: player.id,
        playerName: player.name,
        skill,
        oldLevel: level - 1,
        newLevel: level,
        newProgress: progress,
      });
      Logger.system(`🏆 ${player.name} avançou ${skill} para nível ${level}!`);
    }

    Logger.skill(
      `${player.name} ganhou ${amount} progresso em ${skill} (${progress.toFixed(1)}/100)`,
    );
  }

  /**
   * Retorna o bônus de dano para uma skill ofensiva (SWORD, AXE, CLUB, DISTANCE) com base no nível.
   *
   * @param player - Jogador
   * @param skill - Skill ofensiva (ex.: `SkillType.SWORD`)
   * @returns Multiplicador de dano (ex.: 1.2 = +20% de dano)
   *
   * @remarks
   * A fórmula é: `1 + (nível - 1) * bônusPorNível`. O bônus por nível é definido em `SkillConfigs`.
   * Se a skill não tiver bônus de dano configurado, retorna 1.0.
   *
   * @example
   * ```typescript
   * // Considerando Sword nível 5 e bônus de 2% por nível: 1 + (5-1)*0.02 = 1.08
   * const bonus = SkillSystem.getDamageBonus(player, SkillType.SWORD);
   * const finalDamage = baseDamage * bonus;
   * ```
   */
  static getDamageBonus(player: Player, skill: SkillType): number {
    const skillData = player.skills.get(skill);
    if (!skillData) return 1.0;
    const config = SkillConfigs[skill];
    if (!config.damageBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.damageBonusPerLevel;
  }

  /**
   * Retorna o bônus de defesa concedido pela skill Shielding.
   *
   * @param player - Jogador
   * @returns Multiplicador de defesa (ex.: 1.2 = +20% de defesa)
   *
   * @remarks
   * A fórmula é `1 + (nível - 1) * bônusPorNível`. O bônus por nível é definido em `SkillConfigs`.
   * Se a skill não tiver bônus de defesa configurado, retorna 1.0.
   *
   * @example
   * ```typescript
   * const defenseBonus = SkillSystem.getDefenseBonus(player);
   * player.defense = baseDefense * defenseBonus;
   * ```
   */
  static getDefenseBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.SHIELDING);
    if (!skillData) return 1.0;
    const config = SkillConfigs[SkillType.SHIELDING];
    if (!config.defenseBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.defenseBonusPerLevel;
  }

  /**
   * Retorna o bônus de acerto para a skill Distance (afeta a chance de acerto em ataques à distância).
   *
   * @param player - Jogador
   * @returns Bônus de acerto em pontos percentuais (ex.: 5 = +5% de chance de acerto)
   *
   * @remarks
   * A fórmula é `(nível - 1) * bônusPorNível`. O bônus por nível é definido em `SkillConfigs`.
   * Se a skill não tiver bônus de acerto configurado, retorna 0.
   *
   * @example
   * ```typescript
   * const hitBonus = SkillSystem.getHitChanceBonus(player);
   * const finalHitChance = baseHitChance + hitBonus;
   * ```
   */
  static getHitChanceBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.DISTANCE);
    if (!skillData) return 0;
    const config = SkillConfigs[SkillType.DISTANCE];
    if (!config.hitChanceBonusPerLevel) return 0;
    return (skillData.level - 1) * config.hitChanceBonusPerLevel;
  }
}
