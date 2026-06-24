import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";

/**
 * Centraliza o envio de pacotes WebSocket para o cliente.
 * Responsável por serializar e enviar mensagens específicas do domínio de movimento.
 */
export class PacketSender {
  constructor(private ws: WebSocket) {}

  /**
   * Envia a posição atualizada do jogador.
   */
  sendPosition(x: number, y: number): void {
    this.ws.send(JSON.stringify({ type: "position", x, y }));
  }

  /**
   * Notifica o cliente que o ataque automático foi interrompido.
   */
  sendAutoAttackStopped(reason: string): void {
    this.ws.send(JSON.stringify({ type: "autoAttackStopped", reason }));
  }

  // =========================
  // LOOT
  // =========================

  sendLootWindow(corpseId: string, items: any[]): void {
    this.ws.send(
      JSON.stringify({
        type: "lootWindow",
        corpseId,
        items,
      }),
    );
  }

  sendLootTaken(corpseId: string, itemIndex?: number): void {
    this.ws.send(
      JSON.stringify({
        type: "lootTaken",
        corpseId,
        itemIndex,
      }),
    );
  }

  sendLootError(message: string): void {
    this.ws.send(JSON.stringify({ type: "lootError", message }));
  }

  // =========================
  // INVENTÁRIO E EQUIPAMENTO
  // =========================

  sendInventory(player: Player): void {
    const itemsArray = Array.from(player.inventory.entries()).map(([itemId, qty]) => ({
      itemId,
      amount: qty,
    }));
    this.ws.send(
      JSON.stringify({
        type: "inventory",
        gold: player.gold,
        items: itemsArray,
      }),
    );
  }

  sendEquipment(player: Player): void {
    const itemsArray = Array.from(player.equipment.entries()).map(([slot, itemId]) => ({
      slot,
      itemId,
    }));
    this.ws.send(JSON.stringify({ type: "equipment", items: itemsArray }));
  }

  sendPlayerStats(player: Player): void {
    this.ws.send(
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
  }

  sendItemUsed(itemId: string, success: boolean, message: string): void {
    this.ws.send(
      JSON.stringify({
        type: "itemUsed",
        itemId,
        success,
        message,
      }),
    );
  }

  sendUnequipResult(success: boolean, message: string): void {
    this.ws.send(JSON.stringify({ type: "unequipResult", success, message }));
  }

  sendDropError(message: string): void {
    this.ws.send(JSON.stringify({ type: "dropError", message }));
  }

  sendPickupError(message: string): void {
    this.ws.send(JSON.stringify({ type: "pickupError", message }));
  }

  sendError(message: string): void {
    this.ws.send(JSON.stringify({ type: "error", message }));
  }
}
