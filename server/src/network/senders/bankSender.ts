import { BaseSender } from "./base/baseSender";
import type { ServerBankWindowMessage, ServerBankResultMessage, ServerBankErrorMessage } from "../messages/server/social.messages";

export class BankSender extends BaseSender {
  /**
   * Envia a janela do banco com os saldos.
   */
  sendBankWindow(npcId: string, bankGold: number, gold: number): void {
    this.send({
      type: "bankWindow",
      npcId,
      bankGold,
      gold,
    } satisfies ServerBankWindowMessage);
  }

  /**
   * Envia o resultado de uma operação bancária.
   */
  sendBankResult(success: boolean, message: string, bankGold: number, gold: number): void {
    this.send({
      type: "bankResult",
      success,
      message,
      bankGold,
      gold,
    } satisfies ServerBankResultMessage);
  }

  sendBankError(message: string): void {
    this.send({ type: "bankError", message } satisfies ServerBankErrorMessage);
  }
}
