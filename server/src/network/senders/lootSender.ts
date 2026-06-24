import { BaseSender } from "./base/baseSender";

export class LootSender extends BaseSender {
  /**
   * Envia a janela de loot com os itens do corpo.
   */
  sendLootWindow(corpseId: string, items: any[]): void {
    this.send({
      type: "lootWindow",
      corpseId,
      items,
    });
  }

  /**
   * Notifica que o loot foi coletado.
   */
  sendLootTaken(corpseId: string, itemIndex?: number): void {
    this.send({
      type: "lootTaken",
      corpseId,
      itemIndex,
    });
  }

  sendLootError(message: string): void {
    this.send({ type: "lootError", message });
  }
}
