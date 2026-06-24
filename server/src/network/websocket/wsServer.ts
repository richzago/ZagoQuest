/**
 * wsServer.ts
 *
 * Servidor WebSocket para comunicação em tempo real com o cliente Unity.
 * Gerencia conexões, roteamento de mensagens e broadcasts.
 *
 * @module network/websocket/wsServer
 */

import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Player } from "../../game/entities/player";
import { Logger } from "../../game/core/logger/logger";
import { HandlerContext } from "../handlers/HandlerContext";
import { PacketSender } from "../senders";
import { handlers, HandlerFn } from "../handlers/index";
import { BroadcastService } from "./wsBroadcast";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { Corpse } from "../../game/entities/corpse";
import { Monster } from "../../game/entities/monster";
// Importar os novos senders específicos
import {
  InitialStateSender,
  InventorySender,
  PlayerStatsSender,
  WorldStateSender,
} from "../senders";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo.
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private broadcast: BroadcastService;
  private clients: Map<WebSocket, Player> = new Map();
  private static instance: WebSocketServer;

  constructor(server: HttpServer, world: World) {
    WebSocketServer.instance = this;
    this.world = world;
    this.broadcast = new BroadcastService(world);
    this.wss = new WSServer({ server });
    this.init();
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      const player = this.world.players[0];
      if (!player) {
        Logger.error("Nenhum jogador disponível para associar ao WebSocket");
        ws.close();
        return;
      }

      // Registra o cliente no broadcast service
      this.broadcast.registerClient(ws, player);
      this.clients.set(ws, player);

      Logger.system(`Jogador ${player.name} (ID ${player.id}) associado ao socket.`);

      // ============================================
      // ENVIO DE DADOS INICIAIS - USANDO SENDERS
      // ============================================

      // 1. Estado inicial do jogador
      InitialStateSender.send(ws, player);

      // 2. Inventário
      InventorySender.send(ws, player);

      // 3. Estatísticas
      PlayerStatsSender.send(ws, player);

      // 4. Mundo (monstros, NPCs, itens)
      WorldStateSender.send(ws, this.world);

      // ============================================

      // Configura handlers de mensagens
      ws.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          const player = this.clients.get(ws);
          if (!player) return;

          const ctx = new HandlerContext(this.world, this, new PacketSender(ws), this.broadcast);

          const handler = handlers[msg.type] as HandlerFn | undefined;

          if (handler) {
            await handler(ws, player, msg, ctx);
          } else {
            Logger.warn(`Tipo de mensagem desconhecido: ${msg.type}`);
          }
        } catch (err) {
          Logger.error(`Erro ao processar mensagem: ${err}`);
        }
      });

      ws.on("close", () => {
        Logger.system("Cliente desconectado");
        this.broadcast.unregisterClient(ws);
        this.clients.delete(ws);
      });
    });
  }

  // =========================
  // MÉTODOS DELEGADOS PARA BROADCAST (mantém compatibilidade)
  // =========================

  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    this.broadcast.broadcastMove(entityId, x, y, excludeSocket);
  }

  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    this.broadcast.broadcastDamage(targetId, newHp, maxHp, damage);
  }

  public broadcastDespawn(entityId: string): void {
    this.broadcast.broadcastDespawn(entityId);
  }

  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    this.broadcast.broadcastChat(senderName, message, channel);
  }

  public broadcastSpawn(monster: Monster): void {
    this.broadcast.broadcastSpawn(monster);
  }

  public broadcastSpawnCorpse(corpse: Corpse): void {
    this.broadcast.broadcastSpawnCorpse(corpse);
  }

  public broadcastSpawnItemOnGround(item: ItemOnGround): void {
    this.broadcast.broadcastSpawnItemOnGround(item);
  }

  public sendToPlayer(playerId: string, message: string): void {
    this.broadcast.sendToPlayer(playerId, message);
  }

  public sendChatToPlayer(playerId: string, message: string): void {
    this.broadcast.sendChatToPlayer(playerId, message);
  }

  // =========================
  // SINGLETON
  // =========================

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }

  public getBroadcastService(): BroadcastService {
    return this.broadcast;
  }
}
