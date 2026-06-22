/**
 * experienceSystem.ts
 *
 * Sistema de experiência e level up.
 * Totalmente baseado em dados (level, xp) do Player.
 * Agora com envio de playerStats ao cliente sempre que XP ou Level mudam.
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
import { Player } from "../entities/player";
import { WebSocketServer } from "../../network/websocket/wsServer"; // 🔥 import adicionado

/**
 * Gerencia a progressão de nível e experiência do jogador.
 *
 * @remarks
 * A tabela de XP é pré‑calculada para os níveis 1 a 100, usando uma progressão geométrica.
 * A cada nível, o HP máximo do jogador aumenta em 20 e o HP é totalmente restaurado.
 * Eventos `PLAYER_GAIN_XP` e `PLAYER_LEVEL_UP` são emitidos para outros sistemas (quests, conquistas, UI).
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
  // Tabela de XP necessária por nível (pré-calculada até 100)
  private static readonly BASE_XP = 100;
  private static readonly MULTIPLIER = 1.1;
  private static xpTable: Map<number, number> = new Map();

  /**
   * Inicialização estática: preenche a tabela de XP necessária por nível.
   */
  static {
    let required = this.BASE_XP;
    for (let level = 1; level <= 100; level++) {
      this.xpTable.set(level, Math.floor(required));
      required *= this.MULTIPLIER;
    }
  }

  /**
   * Retorna o XP necessário para subir do nível atual para o próximo.
   *
   * @param level - Nível atual do jogador
   * @returns XP necessário para o próximo nível (ou um valor muito alto se nível ≥ 100)
   *
   * @example
   * ```typescript
   * const required = ExperienceSystem.getRequiredXp(player.level);
   * console.log(`Faltam ${required - player.xp} XP para o próximo nível.`);
   * ```
   */
  public static getRequiredXp(level: number): number {
    return this.xpTable.get(level) ?? 999999999;
  }

  /**
   * Adiciona experiência ao jogador e verifica a necessidade de level up.
   *
   * @param player - Jogador que receberá o XP
   * @param amount - Quantidade de XP a adicionar
   * @returns `true` se houve pelo menos um level up, `false` caso contrário
   *
   * @remarks
   * Se o XP acumulado ultrapassar o necessário para o nível atual,
   * o jogador sobe de nível (possivelmente múltiplas vezes) até que o XP
   * acumulado seja inferior ao necessário para o próximo nível.
   * Dispara evento `PLAYER_GAIN_XP` e (se houver level up) `PLAYER_LEVEL_UP`.
   * O log é escrito no canal `SKILL`.
   * Após qualquer alteração, envia `playerStats` atualizado para o cliente.
   *
   * @example
   * ```typescript
   * const leveledUp = ExperienceSystem.addXp(player, 500);
   * if (leveledUp) {
   *   // O jogador subiu de nível, atributos foram atualizados
   * }
   * ```
   */
  public static addXp(player: Player, amount: number): boolean {
    if (amount <= 0 || player.level >= 100) return false;

    player.xp += amount;

    EventSystem.getInstance().emit<PlayerGainXpEventData>(GameEvent.PLAYER_GAIN_XP, {
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

    // ==========================================================
    // 🔥 ENVIA PLAYER STATS ATUALIZADOS PARA O CLIENTE
    // (inclui XP, nível, HP e Mana)
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
          xp: player.xp, // ← incluído para a barra de XP (se o cliente quiser usar)
        }),
      );
      Logger.combat(`[HUD] PlayerStats enviado para ${player.name} (XP atualizado)`);
    }

    return leveledUp;
  }

  /**
   * Aplica os efeitos de um level up.
   *
   * @param player - Jogador que subiu de nível
   * @returns {void}
   *
   * @remarks
   * Aumenta o nível em 1, adiciona +20 ao HP máximo e restaura o HP completamente.
   * Emite evento `PLAYER_LEVEL_UP` e log no canal `SYSTEM`.
   * Futuramente, este método pode ser estendido para aumentar mana, aprender habilidades, etc.
   *
   * @example
   * ```typescript
   * // Internamente chamado por addXp
   * ExperienceSystem.levelUp(player);
   * ```
   */
  private static levelUp(player: Player): void {
    const oldLevel = player.level;
    player.level++;
    player.maxHp += 20;
    player.hp = player.maxHp;

    EventSystem.getInstance().emit<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, {
      playerId: player.id,
      playerName: player.name,
      oldLevel: oldLevel,
      newLevel: player.level,
    });
    Logger.system(
      `${player.name} atingiu o nível ${player.level}! HP máximo agora ${player.maxHp}.`,
    );
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
