import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { PlayerGainXpEventData, PlayerLevelUpEventData } from "../../shared/interfaces/eventData.interface";
import { EventSystem } from "../core/events/eventSystem";
import { Logger } from "../core/logger/logger";
import { Player } from "../entities/player";

/**
 * Sistema de experiência e level up.
 * Totalmente baseado em dados (level, xp) do Player.
 */
export class ExperienceSystem {
  // Tabela de XP necessária por nível (pré-calculada até 100)
  private static readonly BASE_XP = 100;
  private static readonly MULTIPLIER = 1.1;
  private static xpTable: Map<number, number> = new Map();

  static {
    let required = this.BASE_XP;
    for (let level = 1; level <= 100; level++) {
      this.xpTable.set(level, Math.floor(required));
      required *= this.MULTIPLIER;
    }
  }

  /**
   * Retorna XP necessário para subir para o próximo nível.
   */
  public static getRequiredXp(level: number): number {
    return this.xpTable.get(level) ?? 999999999;
  }

  /**
   * Adiciona XP ao jogador. Dispara level up se necessário.
   * @returns true se houve level up
   */
  public static addXp(player: Player, amount: number): boolean {
    if (amount <= 0 || player.level >= 100) return false;

    player.xp += amount;

    EventSystem.getInstance().emit<PlayerGainXpEventData
    >(GameEvent.PLAYER_GAIN_XP, {
      playerId: player.id,
      playerName: player.name,
      amount: amount,
      newTotalXp: player.xp,
    });
    Logger.skill(`${player.name} ganhou ${amount} XP. XP total: ${player.xp}`);

    let leveledUp = false;
    while (player.xp >= this.getRequiredXp(player.level) && player.level < 100) {
      this.levelUp(player);
      leveledUp = true;
    }
    return leveledUp;
  }

  /**
   * Aplica os efeitos de um level up.
   */
  private static levelUp(player: Player): void {
    const oldLevel = player.level;
    player.level++;
    // Aumenta HP máximo (exemplo: +20 por nível)
    player.maxHp += 20;
    player.hp = player.maxHp; // cura total

    EventSystem.getInstance().emit<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, {
      playerId: player.id,
      playerName: player.name,
      oldLevel: oldLevel, // você pode guardar o nível antigo antes de incrementar
      newLevel: player.level,
    });
    Logger.system(
      `${player.name} atingiu o nível ${player.level}! HP máximo agora ${player.maxHp}.`,
    );
    // TODO: disparar evento para client
  }

  /**
   * Calcula o XP recebido ao matar um monstro baseado na diferença de nível.
   * @param monsterLevel Nível do monstro (vindo do JSON)
   * @param playerLevel Nível do jogador
   * @param baseXp XP base do monstro (vindo do JSON)
   */
  public static calculateMonsterXp(
    monsterLevel: number,
    playerLevel: number,
    baseXp: number,
  ): number {
    const diff = monsterLevel - playerLevel;
    let multiplier = 1.0;
    if (diff >= 5) multiplier = 1.5;
    else if (diff <= -5) multiplier = 0.5;
    return Math.max(1, Math.floor(baseXp * multiplier));
  }
}
