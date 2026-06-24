/**
 * playerStatsSender.ts
 *
 * Envia as estatísticas do jogador (HP, Mana, Level, etc.).
 *
 * @module network/senders
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { BaseSender } from "./base/baseSender";

export class PlayerStatsSender extends BaseSender {
  /**
   * Envia as estatísticas do jogador.
   */
  public sendPlayerStats(player: Player): void {
    this.send({
      type: "playerStats",
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      level: player.level,
      attack: player.attack,
      defense: player.defense,
    });
  }

  /**
   * Método estático para uso rápido.
   */
  public static send(ws: WebSocket, player: Player): void {
    const sender = new PlayerStatsSender(ws);
    sender.sendPlayerStats(player);
  }
}
