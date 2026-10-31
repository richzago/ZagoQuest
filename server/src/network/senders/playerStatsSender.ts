// Network: apenas lê e serializa o estado do Player.
import { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { ServerPlayerStatsMessage } from "../messages/server/inventory.messages";
import { BaseSender } from "./base/baseSender";
import { totalXpForLevel, EXPERIENCE_CONFIG } from "../../data/experience/experienceConfig";
import { getPlayerMoveIntervalMs } from "../../game/systems/movementSystem";

export class PlayerStatsSender extends BaseSender {
  /** Formato consistente para conexão, ganho de XP e morte. */
  public static toPayload(player: Player): ServerPlayerStatsMessage {
    const levelStart = totalXpForLevel(player.level);
    const next = player.experienceToNext;
    return {
      type: "playerStats",
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      level: player.level,
      // Ritmo permitido pelo servidor: Unity só agenda o próximo pedido.
      moveIntervalMs: getPlayerMoveIntervalMs(player),
      attack: player.attack,
      defense: player.defense,
      armor: player.armor,
      xp: player.experience,
      xpToNext: next,
      levelXp: player.level >= EXPERIENCE_CONFIG.maxLevel ? 0 : player.experience - levelStart,
      levelXpToNext: player.level >= EXPERIENCE_CONFIG.maxLevel ? 0 : next - levelStart,
      lifetimeXp: player.lifetimeExperience,
      // Aliases temporários até a migração de todos os clientes.
      experience: player.experience,
      experienceToNext: player.experienceToNext,
    };
  }

  public sendPlayerStats(player: Player): void {
    this.send(PlayerStatsSender.toPayload(player));
  }

  public static send(ws: WebSocket, player: Player): void {
    new PlayerStatsSender(ws).sendPlayerStats(player);
  }
}
