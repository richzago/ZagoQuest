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
import { MAX_PACKET_BYTES, parseClientMessage } from "../validation/messageValidation";
import { MessageRateLimiter, OrderedMessageQueue } from "../validation/messageGuards";
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
    // ws rejects oversized frames BEFORE JSON.parse or Zod can allocate objects.
    this.wss = new WSServer({ server, maxPayload: MAX_PACKET_BYTES, perMessageDeflate: false });
    this.init();
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      // IMPORTANTE: não existe autenticação de socket ainda. Enquanto o jogo
      // é single-player, impedimos DOIS sockets de controlar world.players[0].
      // Isto NÃO substitui login/JWT por personagem em um MMORPG público.
      const player = this.world.players[0];
      if (!player) {
        ws.close(1008, "Nenhum personagem disponivel.");
        return;
      }
      if ([...this.clients.values()].some((connected) => connected.id === player.id)) {
        Logger.warn(`Conexão duplicada recusada para ${player.name}.`);
        ws.close(1008, "Personagem ja conectado.");
        return;
      }

      const limiter = new MessageRateLimiter();
      const sender = new PacketSender(ws);
      const ctx = new HandlerContext(this.world, this, sender, this.broadcast);
      const queue = new OrderedMessageQueue((error) => {
        Logger.error(`[NETWORK] Falha no handler: ${String(error)}`);
      });
      let invalidPackets = 0;
      const MAX_INVALID_PACKETS = 3;

      this.clients.set(ws, player);
      this.broadcast.registerClient(ws, player);
      Logger.system(`Jogador ${player.name} (ID ${player.id}) associado ao socket.`);

      // O erro do próprio WebSocket (inclusive payload excessivo) deve ter
      // listener; caso contrário um evento "error" pode derrubar o Node.
      ws.on("error", (error) => {
        Logger.warn(`[NETWORK] Erro no socket de ${player.name}: ${String(error)}`);
      });

      ws.on("close", () => {
        Logger.system(`Cliente ${player.name} desconectado.`);
        this.broadcast.unregisterClient(ws);
        this.clients.delete(ws);
      });

      // Trata mensagens em ordem. JSON.parse nunca recebe entrada não validada
      // por tamanho; os handlers nunca recebem objetos fora do schema.
      ws.on("message", (data, isBinary) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        if (isBinary) {
          ws.close(1003, "Apenas JSON texto e permitido.");
          return;
        }

        // Limite de pacotes por segundo, inclusive pacotes malformados.
        if (!limiter.allow()) {
          Logger.warn(`[NETWORK] Excesso de mensagens de ${player.name}.`);
          ws.close(1008, "Limite de mensagens excedido.");
          return;
        }

        const parsed = parseClientMessage(data.toString());
        if (!parsed.ok) {
          invalidPackets++;
          Logger.warn(`[NETWORK] Mensagem rejeitada de ${player.name}: ${parsed.reason}`);
          if (invalidPackets >= MAX_INVALID_PACKETS) {
            ws.close(1008, "Mensagens invalidas repetidas.");
          } else {
            ws.send(JSON.stringify({
              type: "networkError",
              message: "Mensagem invalida.",
            }));
          }
          return;
        }

        // Defesa contra handlers do protótipo ("constructor", "toString", etc.).
        // O schema já restringe tipos; a checagem do próprio objeto é redundância.
        const type = parsed.message.type;
        if (!Object.prototype.hasOwnProperty.call(handlers, type)) {
          ws.close(1008, "Comando desconhecido.");
          return;
        }
        const handler = handlers[type] as HandlerFn;

        // Um socket não pode enfileirar trabalho ilimitado enquanto o banco
        // ou um handler assíncrono estiver lento.
        if (!queue.enqueue(async () => {
          if (ws.readyState !== WebSocket.OPEN || this.clients.get(ws) !== player) return;
          await handler(ws, player, parsed.message, ctx);
        })) {
          Logger.warn(`[NETWORK] Fila cheia para ${player.name}.`);
          ws.close(1008, "Fila de comandos excedida.");
        }
      });

      // Protocolo existente do Unity: dados iniciais sem mudanças.
      InitialStateSender.send(ws, player);
      InventorySender.send(ws, player);
      PlayerStatsSender.send(ws, player);
      WorldStateSender.send(ws, this.world);
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
