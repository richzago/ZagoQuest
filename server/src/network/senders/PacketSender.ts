import { WebSocket } from "ws";

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
}
