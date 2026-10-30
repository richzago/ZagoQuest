/**
 * experienceSystem.ts
 *
 * Sistema de experiência e level up.
 * Fórmula personalizada
 * XP(level) = floor((0.3 * level^3 + 5 * level^2 + 10 * level) * (1 + level * 0.001))
 *
 * @module game/systems/ExperienceSystem
 */

import { GameEvent } from "../../shared/enums/gameEvent.enum";
import {
  PlayerGainXpEventData,
  PlayerLevelUpEventData,
} from "../../shared/interfaces/eventData.interface";
import { EventSystem } from "../core/events/eventSystem";
import { Logger } from "../core/logger/logger";
import type { Player } from "../entities/player";
import { WebSocketServer } from "../../network/websocket/wsServer";
import { PlayerStatsSender } from "../../network/senders/playerStatsSender";

/**
 * Gerencia a progressão de nível e experiência do jogador.
 *
 * @remarks
 * XP_necessario(level) = floor((0.3 * level^3 + 5 * level^2 + 10 * level) * (1 + level * 0.001))
 *
 * Isso gera uma curva de progressão que começa 2% mais difícil no nível 10,
 * chegando a 15% mais difícil no nível 100 e 36% mais difícil no nível 500.
 * A progressão é suave e gradual, evitando desânimo dos jogadores de alto nível.
 *
 * @example
 * ```typescript
 * // Conceder XP ao matar um monstro
 * const leveledUp = ExperienceSystem.addXp(player, 150);
 * if (leveledUp) {
 *   console.log(`Parabéns! Você subiu para o nível ${player.level}`);
 * }
 * ```
 */
export class ExperienceSystem {
  public static readonly MAX_LEVEL = 100;
  /**
   * Retorna o XP necessário para subir do nível atual para o próximo.
   *
   * Fórmula: XP(level) = floor((0.3 * level^3 + 5 * level^2 + 10 * level) * (1 + level * 0.001))
   *
   * @param level - Nível atual do jogador
   * @returns XP necessário para o próximo nível (nunca inferior a 100)
   *
   * @example
   * ```typescript
   * const required = ExperienceSystem.getRequiredXp(player.level);
   * console.log(`Faltam ${required - player.xp} XP para o próximo nível.`);
   * ```
   */
  public static getRequiredXp(level: number): number {
    if (level <= 0) return 100;

    // Fórmula base (aproximação do Tibia)
    const baseXp = 0.3 * Math.pow(level, 3) + 5 * Math.pow(level, 2) + 10 * level;

    // Multiplicador suave e progressivo
    // Nível 10: 1.01x | Nível 100: 1.10x | Nível 500: 1.50x
    const multiplier = 1 + level * 0.001;

    const xp = Math.floor(baseXp * multiplier);

    // Garante um mínimo de 100 XP para os primeiros níveis
    return Math.max(100, xp);
  }

  /**
   * Concede XP usando a mesma regra para todos os jogadores.
   * experience é o XP disponível no nível atual, NÃO o total histórico.
   * No nível 100 o excedente é descartado e novas recompensas são ignoradas.
   *
   * @returns true quando ocorre pelo menos um level up.
   */
  public static addXp(player: Player, amount: number): boolean {
    if (!Number.isSafeInteger(amount) || amount <= 0 || player.level >= this.MAX_LEVEL) {
      return false;
    }

    if (
      !Number.isSafeInteger(player.experience) ||
      player.experience < 0 ||
      !Number.isSafeInteger(player.experience + amount)
    ) {
      Logger.warn(`XP inválido para ${player.name}; progressão não alterada.`);
      return false;
    }

    player.experience += amount;
    let levelsGained = 0;

    while (player.level < this.MAX_LEVEL) {
      const requiredXp = this.getRequiredXp(player.level);
      if (player.experience < requiredXp) break;

      // Primeiro desconta o custo do nível atual; depois avança.
      player.experience -= requiredXp;
      this.levelUp(player);
      levelsGained++;
    }

    if (player.level >= this.MAX_LEVEL) {
      player.experience = 0;
    }

    player.experienceToNext =
      player.level >= this.MAX_LEVEL ? 0 : this.getRequiredXp(player.level);

    if (levelsGained > 0) {
      // A vocação define o ganho de HP/mana por nível.
      player.recalculateStats();
      player.hp = player.maxHp;
      Logger.system(`${player.name} subiu ${levelsGained} nível(is)! Agora nível ${player.level}`);
    }

    EventSystem.getInstance().emit<PlayerGainXpEventData>(GameEvent.PLAYER_GAIN_XP, {
      playerId: player.id,
      playerName: player.name,
      amount,
      currentLevelXp: player.experience,
    });
    Logger.skill(`${player.name} ganhou ${amount} XP. Progresso no nível: ${player.experience}`);

    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.sendToPlayer(player.id, JSON.stringify(PlayerStatsSender.toPayload(player)));
    }

    return levelsGained > 0;
  }

  /** Registra uma subida de nível; atributos são recalculados ao fim do lote. */
  private static levelUp(player: Player): void {
    const oldLevel = player.level;
    player.level++;

    EventSystem.getInstance().emit<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, {
      playerId: player.id,
      playerName: player.name,
      oldLevel,
      newLevel: player.level,
    });
  }

  /**
   * Calcula o XP recebido ao matar um monstro, levando em conta a diferença de nível.
   *
   * @param monsterLevel - Nível do monstro (vindo do JSON)
   * @param playerLevel - Nível do jogador
   * @param baseXp - XP base do monstro (vindo do JSON)
   * @returns XP final ajustado (nunca inferior a 1)
   *
   * @remarks
   * As regras de multiplicador:
   * - Se monstro for 5 ou mais níveis acima do jogador: XP × 1.5 (bônus)
   * - Se monstro for 5 ou mais níveis abaixo do jogador: XP × 0.5 (penalidade)
   * - Caso contrário: XP base
   *
   * O resultado é sempre arredondado para baixo e garantido ≥ 1.
   *
   * @example
   * ```typescript
   * // Monstro nível 10, jogador nível 6, baseXP 100 → dif = 4 → XP = 100
   * // Monstro nível 15, jogador nível 8, baseXP 100 → dif = 7 → XP = 150
   * const xp = ExperienceSystem.calculateMonsterXp(15, 8, 100); // 150
   * ```
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
