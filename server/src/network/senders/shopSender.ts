import { BaseSender } from "./base/baseSender";

export class ShopSender extends BaseSender {
  /**
   * Envia a janela da loja com os itens disponíveis.
   */
  sendShopWindow(npcId: string, items: any[]): void {
    this.send({
      type: "shopWindow",
      npcId,
      items,
    });
  }

  /**
   * Envia o resultado da compra.
   */
  sendBuyResult(success: boolean, message: string): void {
    this.send({ type: "buyResult", success, message });
  }

  sendShopError(message: string): void {
    this.send({ type: "shopError", message });
  }
}
