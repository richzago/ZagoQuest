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
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";
import type { ServerEquipmentMessage } from "../messages/server/inventory.messages";

export class InventorySender extends BaseSender {
  /**
   * Envia o inventário completo do jogador.
   */
  public sendInventory(player: Player): void {
    const itemsArray: Array<{
      itemId: string; amount: number; itemType?: string; instanceId?: string
    }> = [];
    // Separar Bags não-stackable por identidade. Duas Simple Bags do mesmo
    // tipo nunca podem aparecer como "x2" com um clique ambíguo.
    const visibleChildren = player.getVisibleBagChildren();
    for (const [itemId, qty] of player.inventory.entries()) {
      let itemType: string | undefined;
      try { itemType = ItemRegistry.get(itemId).type; }
      catch { /* Save legado: mantém o ID literal. */ }

      if (player.isContainerItem(itemId)) {
        const instances = visibleChildren.filter(child => child.itemId === itemId);
        for (const instance of instances)
          itemsArray.push({itemId, amount:1, itemType, instanceId:instance.instanceId});
        // Se um save legado tiver contagem sem uma instância correspondente,
        // não apagar ou esconder suas unidades do cliente.
        const untracked = qty - instances.length;
        if (untracked > 0) itemsArray.push({itemId,amount:untracked,itemType});
      } else {
        itemsArray.push({itemId,amount:qty,itemType});
      }
    }

    this.send({
      type: "inventory",
      gold: player.gold,
      items: itemsArray,
      bagItemId: player.getContainerItemId(),
      bagSlots: player.getContainerCapacity(),
      slotsUsed: player.getContainerSlotsUsed(),
      capUsed: player.getCarriedWeight(),
      capMax: player.getMaxCarryWeight(),
      capRemaining: player.getRemainingCap(),
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
    const items: { slot: string; itemId: string }[] = [];

    for (const [slot, itemId] of player.equipment.entries()) {
      items.push({ slot, itemId });
    }

    const payload = {
      type: "equipment",
      items,
    } satisfies ServerEquipmentMessage;

    Logger.system(`[SERVER] Enviando equipment: ${JSON.stringify(payload)}`);

    // 🔥 Passa o objeto, não uma string
    this.send(payload);
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
