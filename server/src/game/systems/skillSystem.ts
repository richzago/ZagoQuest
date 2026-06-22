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
import { WebSocketServer } from "../../network/websocket/wsServer"; // 🔥 import adicionado

export class SkillSystem {
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

      // ==========================================================
      // 🔥 ENVIA PLAYER STATS QUANDO HÁ LEVEL UP (nível mudou)
      // ==========================================================
      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        wsServer.sendToPlayer(
          player.id,
          JSON.stringify({
            type: "playerStats",
            hp: player.hp,
            maxHp: player.maxHp,
            mana: player.mana,
            maxMana: player.maxMana,
            level: player.level,
            attack: player.attack,
            defense: player.defense,
          }),
        );
        Logger.combat(`[HUD] PlayerStats enviado para ${player.name} (skill level up)`);
      }
    }

    Logger.skill(
      `${player.name} ganhou ${amount} progresso em ${skill} (${progress.toFixed(1)}/100)`,
    );
  }

  static getDamageBonus(player: Player, skill: SkillType): number {
    const skillData = player.skills.get(skill);
    if (!skillData) return 1.0;
    const config = SkillConfigs[skill];
    if (!config.damageBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.damageBonusPerLevel;
  }

  static getDefenseBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.SHIELDING);
    if (!skillData) return 1.0;
    const config = SkillConfigs[SkillType.SHIELDING];
    if (!config.defenseBonusPerLevel) return 1.0;
    return 1 + (skillData.level - 1) * config.defenseBonusPerLevel;
  }

  static getHitChanceBonus(player: Player): number {
    const skillData = player.skills.get(SkillType.DISTANCE);
    if (!skillData) return 0;
    const config = SkillConfigs[SkillType.DISTANCE];
    if (!config.hitChanceBonusPerLevel) return 0;
    return (skillData.level - 1) * config.hitChanceBonusPerLevel;
  }
}
