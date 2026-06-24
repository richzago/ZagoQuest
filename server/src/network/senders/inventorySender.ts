/**
 * inventorySender.ts
 *
 * Envia inventário e equipamento do jogador.
 *
 * @module network/senders
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { BaseSender } from "./base/baseSender";

export class InventorySender extends BaseSender {
  /**
   * Envia o inventário completo do jogador.
   */
  public sendInventory(player: Player): void {
    const itemsArray = Array.from(player.inventory.entries()).map(([itemId, qty]) => ({
      itemId,
      amount: qty,
    }));

    this.send({
      type: "inventory",
      gold: player.gold,
      items: itemsArray,
    });
  }

  /**
   * Envia apenas o gold do jogador.
   */
  public sendGold(player: Player): void {
    this.send({
      type: "gold",
      gold: player.gold,
    });
  }

  /**
   * Envia o equipamento atual do jogador.
   */
  public sendEquipment(player: Player): void {
    const slots: Record<string, string | null> = {};
    for (const [slot, itemId] of player.equipment.entries()) {
      slots[slot] = itemId;
    }

    this.send({
      type: "equipment",
      slots,
    });
  }

  /**
   * Envia resultado do uso de um item.
   */
  public sendItemUsed(itemId: string, success: boolean, message: string): void {
    this.send({
      type: "itemUsed",
      itemId,
      success,
      message,
    });
  }

  /**
   * Envia erro genérico.
   */
  public sendError(message: string): void {
    this.send({
      type: "error",
      message,
    });
  }

  /**
   * Envia resultado do desequipamento.
   */
  public sendUnequipResult(success: boolean, message: string): void {
    this.send({
      type: "unequipResult",
      success,
      message,
    });
  }

  /**
   * Envia erro de drop.
   */
  public sendDropError(message: string): void {
    this.send({
      type: "dropError",
      message,
    });
  }

  /**
   * Envia erro de pickup.
   */
  public sendPickupError(message: string): void {
    this.send({
      type: "pickupError",
      message,
    });
  }

  /**
   * Envia as estatísticas do jogador (delega para PlayerStatsSender).
   */
  public sendPlayerStats(player: Player): void {
    // Importação dinâmica para evitar circular dependency
    const { PlayerStatsSender } = require("./playerStatsSender");
    PlayerStatsSender.send(this.ws, player);
  }

  /**
   * Método estático para uso rápido.
   */
  public static send(ws: WebSocket, player: Player): void {
    const sender = new InventorySender(ws);
    sender.sendInventory(player);
  }
}
