import { World } from "../world/world";
import { ItemEntity } from "../entities/item";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { Logger } from "../core/logger/logger";

export class ItemSystem {
  private nextId = 10000;

  constructor(private world: World) {}

  /**
   * Cria um item no chão, empilha se existir na mesma posição.
   */
  dropItem(itemId: string, amount: number, x: number, y: number): void {
    const type = ItemRegistry.get(itemId);
    if (!type) {
      Logger.error(`Item desconhecido: ${itemId}`);
      return;
    }

    // Tenta empilhar com item existente na posição
    const existing = this.world.getItemAt(x, y);
    if (existing && existing.type.id === itemId && existing.type.stackable) {
      const maxStack = existing.type.maxStack ?? 999;
      const newAmount = existing.amount + amount;
      if (newAmount <= maxStack) {
        existing.amount = newAmount;
        Logger.world(`Empilhado ${amount}x ${type.name} em (${x},${y})`);
        return;
      }
      // se ultrapassar, deixa o máximo e o resto como novo drop (lógica futura)
    }

    const item = new ItemEntity(this.nextId++, type, amount, x, y);
    this.world.addItem(item);
    Logger.world(`Drop: ${amount}x ${type.name} em (${x},${y})`);
  }

  /**
   * Remove um item do mundo (quando coletado).
   */
  removeItem(item: ItemEntity): void {
    this.world.removeItem(item);
  }
}
