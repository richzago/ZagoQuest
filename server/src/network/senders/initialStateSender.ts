/**
 * initialStateSender.ts
 *
 * Envia o estado inicial do jogador (posição, ID).
 *
 * @module network/senders
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { BaseSender } from "./base/baseSender";

export class InitialStateSender extends BaseSender {
  /**
   * Envia o estado inicial do jogador.
   */
  public sendInitialState(player: Player): void {
    this.send({
      type: "init",
      playerId: player.id,
      playerName: player.name,
      x: player.position.x,
      y: player.position.y,
    });
  }

  /**
   * Método estático para uso rápido.
   */
  public static send(ws: WebSocket, player: Player): void {
    const sender = new InitialStateSender(ws);
    sender.sendInitialState(player);
  }
}
