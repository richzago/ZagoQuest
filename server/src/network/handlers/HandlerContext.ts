import { World } from "../../game/world/World";
import { WebSocketServer } from "../websocket/wsServer";
import { PacketSender } from "../senders"; // ← importa o agrupador de senders

/**
 * Contexto passado para todos os handlers.
 * Contém dependências compartilhadas (mundo, servidor WebSocket, sender de pacotes).
 */
export class HandlerContext {
  constructor(
    public world: World,
    public wsServer: WebSocketServer,
    public packetSender: PacketSender, // ← agora o tipo está correto
  ) {}
}
