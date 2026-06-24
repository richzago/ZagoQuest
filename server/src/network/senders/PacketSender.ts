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
  // INVENTÁRIO
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
}
