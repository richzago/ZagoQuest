/**
 * Sistema de XP cumulativo: o total NUNCA é descontado em level-ups.
 * A fórmula fica em data/experience/experienceConfig.ts.
 */
import { EXPERIENCE_CONFIG, totalXpForLevel } from "../../data/experience/experienceConfig";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import type {
  PlayerGainXpEventData,
  PlayerLevelUpEventData,
} from "../../shared/interfaces/eventData.interface";
import { EventSystem } from "../core/events/eventSystem";
import { Logger } from "../core/logger/logger";
import type { Player } from "../entities/player";
import { WebSocketServer } from "../../network/websocket/wsServer";
import { PlayerStatsSender } from "../../network/senders/playerStatsSender";

export class ExperienceSystem {
  static readonly MAX_LEVEL = EXPERIENCE_CONFIG.maxLevel;

  /** XP acumulado exigido para ALCANÇAR determinado nível. */
  static getTotalXpForLevel(level: number): number {
    return totalXpForLevel(level);
  }

  /** Limite absoluto de XP para chegar ao próximo nível. */
  static getRequiredXp(currentLevel: number): number {
    return totalXpForLevel(Math.min(currentLevel + 1, this.MAX_LEVEL));
  }

  /** XP ganho desde que o personagem alcançou o nível atual. */
  static getLevelProgress(player: Player): number {
    return player.experience - totalXpForLevel(player.level);
  }

  /** XP exigido, apenas dentro do nível atual (para a barra da interface). */
  static getLevelRequirement(level: number): number {
    return level >= this.MAX_LEVEL ? 0 : this.getRequiredXp(level) - totalXpForLevel(level);
  }

  /**
   * Recebe XP e avança todos os níveis alcançados.
   * experience: XP acumulado atual (pode diminuir por morte).
   * lifetimeExperience: XP ganho em toda a trajetória (nunca diminui).
   */
  static addXp(player: Player, amount: number): boolean {
    if (!Number.isSafeInteger(amount) || amount <= 0 || player.level >= this.MAX_LEVEL) {
      return false;
    }

    const cap = totalXpForLevel(this.MAX_LEVEL);
    if (
      !Number.isSafeInteger(player.experience) ||
      !Number.isSafeInteger(player.lifetimeExperience) ||
      player.experience < totalXpForLevel(player.level) ||
      player.experience > cap ||
      player.lifetimeExperience < 0
    ) {
      Logger.warn(`Estado de XP inválido para ${player.name}; recompensa rejeitada.`);
      return false;
    }

    const granted = Math.min(amount, cap - player.experience);
    if (granted <= 0 || !Number.isSafeInteger(player.lifetimeExperience + granted)) return false;

    // Soma uma única vez; o XP nunca é gasto quando sobe de nível.
    player.experience += granted;
    player.lifetimeExperience += granted;

    let levelsGained = 0;
    while (
      player.level < this.MAX_LEVEL &&
      player.experience >= this.getRequiredXp(player.level)
    ) {
      const oldLevel = player.level++;
      levelsGained++;
      EventSystem.getInstance().emit<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, {
        playerId: player.id,
        playerName: player.name,
        oldLevel,
        newLevel: player.level,
      });
    }

    player.experienceToNext = this.getRequiredXp(player.level);
    if (levelsGained > 0) {
      player.recalculateStats();
      player.hp = player.maxHp;
      Logger.system(`${player.name} subiu ${levelsGained} nível(is), agora level ${player.level}.`);
    }

    EventSystem.getInstance().emit<PlayerGainXpEventData>(GameEvent.PLAYER_GAIN_XP, {
      playerId: player.id,
      playerName: player.name,
      amount: granted,
      newTotalXp: player.experience,
      lifetimeXp: player.lifetimeExperience,
    });
    Logger.skill(`${player.name} recebeu ${granted} XP (total: ${player.experience}).`);

    const ws = WebSocketServer.getInstance();
    if (ws) ws.sendToPlayer(player.id, JSON.stringify(PlayerStatsSender.toPayload(player)));
    return levelsGained > 0;
  }

  /**
   * Penalidade simples de morte: perde 10% do progresso DO NÍVEL ATUAL.
   * Não reduz o nível nem altera lifetimeExperience. Um sistema de delevel
   * pode ser implementado separadamente quando definirmos essa regra.
   */
  static applyDeathPenalty(player: Player, ratio = 0.1): number {
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) return 0;
    const progress = Math.max(0, this.getLevelProgress(player));
    const lost = Math.floor(progress * ratio);
    player.experience -= lost;
    return lost;
  }

  /** Converte o progresso de saves antigos, preservando nível e percentual. */
  static migrateLegacyXp(level: number, oldProgress: number): number {
    const base = totalXpForLevel(level);
    if (level >= this.MAX_LEVEL) return base;

    // Antiga fórmula: XP dentro de cada nível, não acumulativo.
    const oldRequired = Math.max(
      100,
      Math.floor(
        (0.3 * level ** 3 + 5 * level ** 2 + 10 * level) * (1 + level * 0.001),
      ),
    );
    const fraction = Math.min(0.999999, Math.max(0, oldProgress / oldRequired || 0));
    return base + Math.floor(fraction * this.getLevelRequirement(level));
  }

  /**
   * Divide um prêmio inteiro (XP) proporcionalmente ao dano REAL registrado.
   * Maior resto recebe unidades que não cabem na divisão inteira. Em empate,
   * prioriza maior dano e, por último, ID para resultado determinístico.
   * Somatório de parcelas = totalXp, sem criação de XP por arredondamento.
   */
  static splitXpByDamage(
    totalXp: number, damageByPlayer: ReadonlyMap<string, number>,
  ): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    if (!Number.isSafeInteger(totalXp) || totalXp <= 0) return result;

    const entries = [...damageByPlayer].filter(([id, damage]) =>
      id.length > 0 && Number.isSafeInteger(damage) && damage > 0);
    const totalDamage = entries.reduce((sum, [, damage]) => sum + damage, 0);
    if (entries.length === 0 || !Number.isSafeInteger(totalDamage) ||
        totalDamage <= 0) return result;

    const shares = entries.map(([id, damage]) => {
      const raw = totalXp * (damage / totalDamage);
      const whole = Math.floor(raw);
      return { id, damage, whole, fraction: raw - whole };
    });
    // Distribuir apenas unidades restantes, sem alterar a soma final.
    let remainder = totalXp - shares.reduce((sum, s) => sum + s.whole, 0);
    shares.sort((a, b) =>
      b.fraction - a.fraction || b.damage - a.damage || a.id.localeCompare(b.id));
    for (const entry of shares) {
      if (remainder-- > 0) entry.whole++;
      result.set(entry.id, entry.whole);
    }
    return result;
  }

  /** Multiplica o XP básico do monstro em função da diferença de nível. */
  static calculateMonsterXp(monsterLevel: number, playerLevel: number, baseXp: number): number {
    const diff = monsterLevel - playerLevel;
    const multiplier = diff >= 5 ? 1.5 : diff <= -5 ? 0.5 : 1;
    return Math.max(1, Math.floor(baseXp * multiplier));
  }
}
