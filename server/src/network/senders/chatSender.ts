import { BaseSender } from "./base/baseSender";

export class ChatSender extends BaseSender {
  /**
   * Envia uma mensagem de chat.
   */
  sendChat(message: string): void {
    this.send({ type: "chat", message });
  }
}
