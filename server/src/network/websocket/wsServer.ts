/**
 * wsServer.ts
 *
 * Servidor WebSocket para comunicação em tempo real com o cliente Unity.
 * Gerencia conexões, movimentos, chat, combate, spawn/despawn, loot e inventário.
 * Agora com suporte a movimento por direção (grid) e ataque automático.
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
import { handleMove, handleMoveDir } from "../handlers/move.handler";
import { HandlerContext } from "../handlers/HandlerContext";
import { handleChat } from "../handlers/chat.handler";
import {
  handleAttack,
  handleStartAutoAttack,
  handleStopAutoAttack,
} from "../handlers/attack.handler";
import { handleLoot, handleTakeLoot } from "../handlers/loot.handler";
import {
  handleDropItem,
  handleEquipItem,
  handlePickupItem,
  handleUnequipItem,
  handleUseItem,
} from "../handlers/inventory.handler";
import { PacketSender } from "../senders";
import { handleBuyItem, handleOpenShop } from "../handlers/shop.handler";
import { handleDeposit, handleOpenBank, handleWithdraw } from "../handlers/bank.handler";

/**
 * Direções possíveis para movimento estilo Tibia.
 */
type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo.
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private clients: Map<WebSocket, Player> = new Map(); // Mapeamento socket -> jogador
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
          const ctx = new HandlerContext(this.world, this, new PacketSender(ws));
          switch (msg.type) {
            case "move":
              await handleMove(ws, player, msg, ctx);
              break;
            case "moveDir":
              handleMoveDir(ws, player, msg, ctx);
              break;

            case "attack":
              await handleAttack(ws, player, msg, ctx);
              break;
            case "startAutoAttack":
              handleStartAutoAttack(ws, player, msg, ctx);
              break;
            case "stopAutoAttack":
              handleStopAutoAttack(ws, player, msg, ctx);
              break;

            case "chat":
              await handleChat(ws, player, msg, ctx);
              break;

            case "loot":
              await handleLoot(ws, player, msg, ctx);
              break;
            case "takeLoot":
              await handleTakeLoot(ws, player, msg, ctx);
              break;

            case "useItem":
              await handleUseItem(ws, player, msg, ctx);
              break;
            case "dropItem":
              await handleDropItem(ws, player, msg, ctx);
              break;
            case "equipItem":
              await handleEquipItem(ws, player, msg, ctx);
              break;
            case "unequipItem":
              await handleUnequipItem(ws, player, msg, ctx);
              break;
            case "pickupItem":
              await handlePickupItem(ws, player, msg, ctx);
              break;

            case "openShop":
              await handleOpenShop(ws, player, msg, ctx);
              break;
            case "buyItem":
              await handleBuyItem(ws, player, msg, ctx);
              break;
            case "openBank":
              await handleOpenBank(ws, player, msg, ctx);
              break;
            case "deposit":
              await handleDeposit(ws, player, msg, ctx);
              break;
            case "withdraw":
              await handleWithdraw(ws, player, msg, ctx);
              break;
            default:
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
  // MÉTODOS EXISTENTES (MOVIMENTO, CHAT, LOOT, INVENTÁRIO, ECONOMIA)
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

  /**
   * Envia ao cliente todos os monstros e NPCs atualmente vivos no mundo.
   * @param ws - WebSocket do cliente.
   */

  // =========================
  // 1. ENVIA MONSTERS
  // =========================

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

    // =========================
    // 2. ENVIA NPCS
    // =========================
    for (const npc of this.world.npcs) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: npc.id,
          name: npc.name,
          x: npc.position.x,
          y: npc.position.y,
          npcType: npc.npcType, // ← ESSENCIAL para o cliente saber o tipo (merchant, banker, etc.)
        }),
      );
    }
    Logger.world(`Enviados ${this.world.npcs.length} NPCs para o cliente`);
  }

  private sendGold(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "goldUpdate",
        gold: player.gold,
        bankGold: player.bankGold,
      }),
    );
  }

  /**
   * Envia uma mensagem de spawn de um item no chão para todos os clientes.
   * @param itemOnGround - Item no chão a ser spawnado.
   */
  public broadcastSpawnItemOnGround(itemOnGround: ItemOnGround): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: itemOnGround.id,
      name: itemOnGround.itemName,
      x: itemOnGround.position.x,
      y: itemOnGround.position.y,
      itemId: itemOnGround.itemId,
      amount: itemOnGround.amount,
      isItem: true, // ← indica que é um item, não um monstro/NPC
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  // =========================
  // BROADCASTS E UTILITÁRIOS
  // =========================

  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    const msg = JSON.stringify({ type: "damage", targetId, newHp, maxHp, damage });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    const formatted = `[${channel.toUpperCase()}] ${senderName}: ${message}`;
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "chat", message: formatted }));
    }
  }

  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    for (const [socket] of this.clients.entries()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) socket.send(msg);
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

  public broadcastDespawn(entityId: string): void {
    Logger.system(`[DESPAWN] Enviando despawn para entidade ${entityId}`);
    const msg = JSON.stringify({ type: "despawn", id: entityId });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
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

  private sendInventory(ws: WebSocket, player: Player): void {
    const itemsArray: { itemId: string; amount: number }[] = [];
    for (const [itemId, qty] of player.inventory.entries()) {
      itemsArray.push({ itemId, amount: qty });
    }
    const payload = JSON.stringify({
      type: "inventory",
      gold: player.gold,
      items: itemsArray,
    });
    ws.send(payload);
    Logger.loot(`Inventário enviado para ${player.name} (${player.inventory.size} tipos de itens)`);
    Logger.system(`[INVENTORY DEBUG] Payload enviado: ${payload}`);
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

  /**
   * Envia uma mensagem JSON qualquer para um jogador específico.
   * @param playerId - ID do jogador destino.
   * @param message - String JSON a ser enviada.
   */
  public sendToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        break;
      }
    }
  }

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }
}
