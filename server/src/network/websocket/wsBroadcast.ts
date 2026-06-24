/**
 * wsBroadcast.ts
 *
 * Camada de broadcast centralizada para envio de mensagens para todos os clientes.
 * Gerencia todas as notificações em massa do servidor.
 *
 * @module network/websocket/wsBroadcast
 */

import { WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Player } from "../../game/entities/player";
import { Monster } from "../../game/entities/monster";
import { Corpse } from "../../game/entities/corpse";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { Logger } from "../../game/core/logger/logger";

/**
 * Interface que define os métodos de broadcast disponíveis.
 */
export interface IBroadcastService {
  /**
   * Transmite movimento de uma entidade para todos os clientes.
   */
  broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void;

  /**
   * Transmite dano causado a um alvo.
   */
  broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void;

  /**
   * Transmite o desaparecimento de uma entidade.
   */
  broadcastDespawn(entityId: string): void;

  /**
   * Transmite uma mensagem de chat para todos.
   */
  broadcastChat(senderName: string, message: string, channel?: string): void;

  /**
   * Transmite o spawn de um monstro.
   */
  broadcastSpawn(monster: Monster): void;

  /**
   * Transmite o spawn de um cadáver.
   */
  broadcastSpawnCorpse(corpse: Corpse): void;

  /**
   * Transmite o spawn de um item no chão.
   */
  broadcastSpawnItemOnGround(item: ItemOnGround): void;

  /**
   * Envia mensagem para um jogador específico.
   */
  sendToPlayer(playerId: string, message: string): void;

  /**
   * Envia mensagem de chat para um jogador específico.
   */
  sendChatToPlayer(playerId: string, message: string): void;

  /**
   * Obtém todos os clientes conectados.
   */
  getClients(): Map<WebSocket, Player>;
}

/**
 * Serviço de broadcast responsável por enviar mensagens para todos os clientes.
 */
export class BroadcastService implements IBroadcastService {
  private clients: Map<WebSocket, Player> = new Map();
  private world: World;
  private static instance: BroadcastService;

  constructor(world: World) {
    this.world = world;
    BroadcastService.instance = this;
  }

  /**
   * Registra um novo cliente na lista de broadcast.
   */
  public registerClient(ws: WebSocket, player: Player): void {
    this.clients.set(ws, player);
    Logger.system(`Cliente ${player.name} registrado para broadcast`);
  }

  /**
   * Remove um cliente da lista de broadcast.
   */
  public unregisterClient(ws: WebSocket): void {
    const player = this.clients.get(ws);
    if (player) {
      Logger.system(`Cliente ${player.name} removido do broadcast`);
    }
    this.clients.delete(ws);
  }

  /**
   * Obtém todos os clientes conectados.
   */
  public getClients(): Map<WebSocket, Player> {
    return this.clients;
  }

  /**
   * Verifica se um socket está válido para envio.
   */
  private isValidSocket(ws: WebSocket): boolean {
    return ws.readyState === WebSocket.OPEN;
  }

  /**
   * Envia mensagem para todos os clientes, exceto um opcional.
   */
  private broadcastMessage(message: string, excludeSocket?: WebSocket): void {
    for (const [socket] of this.clients.entries()) {
      if (socket !== excludeSocket && this.isValidSocket(socket)) {
        socket.send(message);
      }
    }
  }

  /**
   * Transmite movimento de uma entidade.
   */
  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    this.broadcastMessage(msg, excludeSocket);
  }

  /**
   * Transmite dano causado a um alvo.
   */
  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    const msg = JSON.stringify({
      type: "damage",
      targetId,
      newHp,
      maxHp,
      damage,
    });
    this.broadcastMessage(msg);
  }

  /**
   * Transmite o desaparecimento de uma entidade.
   */
  public broadcastDespawn(entityId: string): void {
    Logger.system(`[BROADCAST] Despawning entity ${entityId}`);
    const msg = JSON.stringify({ type: "despawn", id: entityId });
    this.broadcastMessage(msg);
  }

  /**
   * Transmite uma mensagem de chat.
   */
  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    const formatted = `[${channel.toUpperCase()}] ${senderName}: ${message}`;
    const msg = JSON.stringify({ type: "chat", message: formatted });
    this.broadcastMessage(msg);
  }

  /**
   * Transmite o spawn de um monstro.
   */
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
    this.broadcastMessage(msg);
  }

  /**
   * Transmite o spawn de um cadáver.
   */
  public broadcastSpawnCorpse(corpse: Corpse): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: corpse.id,
      name: "Corpse",
      x: corpse.position.x,
      y: corpse.position.y,
    });
    this.broadcastMessage(msg);
  }

  /**
   * Transmite o spawn de um item no chão.
   */
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
    this.broadcastMessage(msg);
  }

  /**
   * Envia mensagem para um jogador específico.
   */
  public sendToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && this.isValidSocket(ws)) {
        ws.send(message);
        break;
      }
    }
  }

  /**
   * Envia mensagem de chat para um jogador específico.
   */
  public sendChatToPlayer(playerId: string, message: string): void {
    this.sendToPlayer(playerId, JSON.stringify({ type: "chat", message }));
  }

  /**
   * Obtém a instância singleton do BroadcastService.
   */
  public static getInstance(): BroadcastService {
    return BroadcastService.instance;
  }
}
