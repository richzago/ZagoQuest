import { BaseSender } from "./base/baseSender";
import { Player } from "../../game/entities/player";

export class InventorySender extends BaseSender {
  /**
   * Envia o inventário completo do jogador.
   */
  sendInventory(player: Player): void {
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
   * Envia os itens equipados do jogador.
   */
  sendEquipment(player: Player): void {
    const itemsArray = Array.from(player.equipment.entries()).map(([slot, itemId]) => ({
      slot,
      itemId,
    }));
    this.send({ type: "equipment", items: itemsArray });
  }

  /**
   * Envia as estatísticas do jogador.
   */
  sendPlayerStats(player: Player): void {
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
   * Envia o resultado do uso de um item.
   */
  sendItemUsed(itemId: string, success: boolean, message: string): void {
    this.send({ type: "itemUsed", itemId, success, message });
  }

  /**
   * Envia o resultado de desequipar um item.
   */
  sendUnequipResult(success: boolean, message: string): void {
    this.send({ type: "unequipResult", success, message });
  }

  /**
   * Envia o gold atualizado do jogador.
   */
  sendGold(player: Player): void {
    this.send({
      type: "goldUpdate",
      gold: player.gold,
      bankGold: player.bankGold,
    });
  }

  sendDropError(message: string): void {
    this.send({ type: "dropError", message });
  }

  sendPickupError(message: string): void {
    this.send({ type: "pickupError", message });
  }

  sendError(message: string): void {
    this.send({ type: "error", message });
  }
}
