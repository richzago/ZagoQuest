/**
 * HandlerContext.ts
 *
 * Contexto compartilhado entre todos os handlers.
 * Fornece acesso ao mundo, servidor WebSocket e serviços.
 *
 * @module network/handlers
 */

import { World } from "../../game/world/World";
import { WebSocketServer } from "../websocket/wsServer";
import { PacketSender } from "../senders";
import { BroadcastService } from "../websocket/wsBroadcast";

/**
 * Contexto compartilhado entre todos os handlers.
 * Contém referências para serviços e sistemas necessários.
 */
export class HandlerContext {
  public world: World;
  public wsServer: WebSocketServer;
  public packetSender: PacketSender;
  public broadcast: BroadcastService;

  constructor(
    world: World,
    wsServer: WebSocketServer,
    packetSender: PacketSender,
    broadcast: BroadcastService,
  ) {
    this.world = world;
    this.wsServer = wsServer;
    this.packetSender = packetSender;
    this.broadcast = broadcast;
  }
}
