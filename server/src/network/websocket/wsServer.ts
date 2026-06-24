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

      // Envia estado inicial
      this.sendInitialState(ws, player);
      this.sendInventory(ws, player);
      this.sendPlayerStats(ws, player);
      this.sendSpawnEntities(ws);

      // Configura handlers de mensagens
      ws.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          const player = this.clients.get(ws);
          if (!player) return;

          const ctx = new HandlerContext(
            this.world,
            this,
            new PacketSender(ws),
            this.broadcast, // Injeta o broadcast service
          );

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
  // MÉTODOS DE ENVIO INICIAL
  // =========================

  private sendInitialState(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "init",
        playerId: player.id,
        x: player.position.x,
        y: player.position.y,
      }),
    );
    Logger.world(`Estado inicial enviado para ${player.name}`);
  }

  private sendSpawnEntities(ws: WebSocket): void {
    // Envia monstros
    for (const monster of this.world.monsters) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: monster.id,
          name: monster.name,
          x: monster.position.x,
          y: monster.position.y,
          hp: monster.hp,
          maxHp: monster.maxHp,
        }),
      );
    }
    Logger.world(`Enviados ${this.world.monsters.length} monstros para o cliente`);

    // Envia NPCs
    for (const npc of this.world.npcs) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: npc.id,
          name: npc.name,
          x: npc.position.x,
          y: npc.position.y,
          npcType: npc.npcType,
        }),
      );
    }
    Logger.world(`Enviados ${this.world.npcs.length} NPCs para o cliente`);

    // Envia itens no chão
    for (const item of this.world.itemsOnGround) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: item.id,
          name: item.itemName,
          x: item.position.x,
          y: item.position.y,
          itemId: item.itemId,
          amount: item.amount,
          isItem: true,
        }),
      );
    }
    Logger.world(`Enviados ${this.world.itemsOnGround.length} itens no chão para o cliente`);
  }

  private sendInventory(ws: WebSocket, player: Player): void {
    const itemsArray = Array.from(player.inventory.entries()).map(([itemId, qty]) => ({
      itemId,
      amount: qty,
    }));
    ws.send(
      JSON.stringify({
        type: "inventory",
        gold: player.gold,
        items: itemsArray,
      }),
    );
    Logger.loot(`Inventário enviado para ${player.name} (${player.inventory.size} tipos de itens)`);
  }

  private sendPlayerStats(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "playerStats",
        hp: player.hp,
        maxHp: player.maxHp,
        mana: player.mana,
        maxMana: player.maxMana,
        level: player.level,
        attack: player.attack,
        defense: player.defense,
      }),
    );
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
