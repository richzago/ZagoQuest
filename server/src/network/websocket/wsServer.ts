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
import { Monster } from "../../game/entities/monster";
import { Corpse } from "../../game/entities/corpse";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { HandlerContext } from "../handlers/HandlerContext";
import { PacketSender } from "../senders";
import { handlers, HandlerFn } from "../handlers/index";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo.
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private clients: Map<WebSocket, Player> = new Map();
  private static instance: WebSocketServer;

  constructor(server: HttpServer, world: World) {
    WebSocketServer.instance = this;
    this.world = world;
    this.wss = new WSServer({ server });
    this.init();
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      const player = this.world.players[0];
      if (player) {
        this.clients.set(ws, player);
        Logger.system(`Jogador ${player.name} (ID ${player.id}) associado ao socket.`);
        this.sendInventory(ws, player);
        this.sendPlayerStats(ws, player);
      } else {
        Logger.error("Nenhum jogador disponível para associar ao WebSocket");
        ws.close();
        return;
      }

      this.sendInitialState(ws, player);
      this.sendSpawnEntities(ws);

      ws.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          const player = this.clients.get(ws);
          if (!player) return;

          const ctx = new HandlerContext(this.world, this, new PacketSender(ws));

          // 🔥 Registry de handlers – substitui o switch
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
  // BROADCASTS
  // =========================

  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    for (const [socket] of this.clients.entries()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    const msg = JSON.stringify({ type: "damage", targetId, newHp, maxHp, damage });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastDespawn(entityId: string): void {
    Logger.system(`[DESPAWN] Enviando despawn para entidade ${entityId}`);
    const msg = JSON.stringify({ type: "despawn", id: entityId });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    const formatted = `[${channel.toUpperCase()}] ${senderName}: ${message}`;
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", message: formatted }));
      }
    }
  }

  public broadcastSpawn(monster: Monster): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: monster.id,
      name: monster.name,
      x: monster.position.x,
      y: monster.position.y,
      hp: monster.hp,
      maxHp: monster.maxHp,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastSpawnCorpse(corpse: Corpse): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: corpse.id,
      name: "Corpse",
      x: corpse.position.x,
      y: corpse.position.y,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastSpawnItemOnGround(item: ItemOnGround): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: item.id,
      name: item.itemName,
      x: item.position.x,
      y: item.position.y,
      itemId: item.itemId,
      amount: item.amount,
      isItem: true,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public sendToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        break;
      }
    }
  }

  public sendChatToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", message }));
        break;
      }
    }
  }

  // =========================
  // SINGLETON
  // =========================

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }
}
