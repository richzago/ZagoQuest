import { Player } from "../entities/player";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { EventSystem } from "../core/events/eventSystem";
import { Logger } from "../core/logger/logger";
import { SkillType } from "../../shared/enums/skillType.enum";
import { SkillLevelUpEventData } from "../../shared/interfaces/skill.interface";

export class SkillSystem {
  /**
   * Adiciona progresso a uma skill do jogador.
   * Se acumular 100 ou mais, sobe de nível e reduz progresso.
   * @param player Jogador
   * @param skill Tipo da skill
   * @param amount Quantidade de progresso (ex: gainPerUse config)
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
   * Retorna o bônus de dano para uma skill ofensiva com base no nível.
   * @param player Jogador
   * @param skill Skill ofensiva (SWORD, AXE, CLUB, DISTANCE)
   * @returns Multiplicador de dano (ex: 1.2 = +20%)
   */
  static getDamageBonus(player: Player, skill: SkillType): number {
    const skillData = player.skills.get(skill);
    if (!skillData) return 1.0;
    const config = SkillConfigs[skill];
    if (!config.damageBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.damageBonusPerLevel;
  }

  /**
   * Bônus de defesa para Shielding (reduz dano recebido).
   */
  static getDefenseBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.SHIELDING);
    if (!skillData) return 1.0;
    const config = SkillConfigs[SkillType.SHIELDING];
    if (!config.defenseBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.defenseBonusPerLevel;
  }

  /**
   * Bônus de acerto para Distance (usado em chance de acerto futuramente).
   */
  static getHitChanceBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.DISTANCE);
    if (!skillData) return 0;
    const config = SkillConfigs[SkillType.DISTANCE];
    if (!config.hitChanceBonusPerLevel) return 0;
    return (skillData.level - 1) * config.hitChanceBonusPerLevel;
  }
}
