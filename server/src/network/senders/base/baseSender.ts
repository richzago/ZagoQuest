import { WebSocket } from "ws";

/**
 * Classe base para todos os senders.
 * Fornece acesso ao WebSocket e um método utilitário para enviar mensagens.
 */
export abstract class BaseSender {
  constructor(protected ws: WebSocket) {}

  /**
   * Envia uma mensagem JSON para o cliente.
   */
  protected send<T>(payload: T): void {
    this.ws.send(JSON.stringify(payload));
  }
}
