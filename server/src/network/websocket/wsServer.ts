/**
 * wsServer.ts
 *
 * Servidor WebSocket para comunicação em tempo real com o cliente Unity.
 * Gerencia conexões, movimentos, chat, combate e atualização de entidades.
 *
 * @module network/websocket/wsServer
 */

import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Player } from "../../game/entities/player";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";
import { ChatSystem } from "../../game/chat/chatSystem";
import { CombatSystem } from "../../game/combat/combatSystem";
import { Monster } from "../../game/entities/monster";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo (posição de entidades, spawn, despawn, chat, combate).
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private clients: Map<WebSocket, Player> = new Map(); // Mapeamento socket -> jogador
  private static instance: WebSocketServer;

  /**
   * Construtor.
   * @param server - Servidor HTTP compartilhado (API + WebSocket)
   * @param world - Instância do mundo do jogo (contém jogadores, monstros, etc.)
   */
  constructor(server: HttpServer, world: World) {
    WebSocketServer.instance = this;
    this.world = world;
    this.wss = new WSServer({ server });
    this.init();
  }

  /**
   * Inicializa os handlers de eventos do WebSocket.
   */
  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      // Associa o jogador ao socket (por enquanto, assume-se apenas um jogador)
      const player = this.world.players[0];
      if (player) {
        this.clients.set(ws, player);
      } else {
        Logger.error("Nenhum jogador disponível para associar ao WebSocket");
        ws.close();
        return;
      }

      // Envia o estado inicial para este cliente
      this.sendInitialState(ws, player);
      this.sendSpawnEntities(ws);

      ws.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          switch (msg.type) {
            case "move":
              this.handleMove(ws, msg);
              break;
            case "chat":
              await this.handleChat(ws, msg);
              break;
            case "attack":
              await this.handleAttack(ws, msg);
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

  /**
   * Envia ao cliente a posição inicial do jogador.
   * @param ws - WebSocket do cliente.
   * @param player - Jogador associado.
   */
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
  private sendSpawnEntities(ws: WebSocket): void {
    // Monstros
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

    // NPCs
    for (const npc of this.world.npcs) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: npc.id,
          name: npc.name,
          x: npc.position.x,
          y: npc.position.y,
        }),
      );
    }
    Logger.world(`Enviados ${this.world.npcs.length} NPCs para o cliente`);
  }

  /**
   * Processa um comando de movimento enviado pelo cliente.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `x` e `y` (posição desejada).
   */
  private handleMove(ws: WebSocket, msg: { x: number; y: number }): void {
    const player = this.clients.get(ws);
    if (!player) return;

    const { x, y } = msg;
    if (this.world.isPositionWalkable(x, y, player.id)) {
      player.position.x = x;
      player.position.y = y;
      ws.send(JSON.stringify({ type: "position", x, y }));
      // Broadcast para outros jogadores (caso haja mais de um)
      this.broadcastMove(player.id, x, y, ws);
    } else {
      ws.send(JSON.stringify({ type: "position", x: player.position.x, y: player.position.y }));
    }
  }

  /**
   * Processa uma mensagem de chat enviada pelo cliente.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com campo `message`.
   */
  private async handleChat(ws: WebSocket, msg: { message: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    let { message } = msg;
    message = message.trim().toLowerCase();

    // Palavras de interação com NPC (sem barra)
    const interactionWords = ["hi", "oi", "olá", "hello", "bye", "tchau"];
    if (interactionWords.includes(message)) {
      const command = message === "bye" || message === "tchau" ? "/bye" : "/hi";
      await processChatCommand(command, player, this.world);
      return;
    }

    if (message.startsWith("/")) {
      await processChatCommand(message, player, this.world);
    } else {
      const channel = (player as any).currentChannel || "local";
      ChatSystem.sendToChannel(player, channel, message);
      this.broadcastChat(player.name, message, channel);
    }
  }

  /**
   * Processa um comando de ataque enviado pelo cliente.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `targetId`.
   */ private async handleAttack(ws: WebSocket, msg: { targetId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const targetId = msg.targetId;
    const target = this.world.monsters.find((m) => m.id === targetId);
    if (!target) {
      Logger.warn(`Jogador ${player.name} tentou atacar monstro inexistente ${targetId}`);
      return;
    }

    // Executa o ataque
    CombatSystem.attack(player, target, this.world);

    // Após o ataque, se o monstro morreu, envia despawn imediato
    if (target.hp <= 0) {
      this.broadcastDespawn(target.id);
    } else {
      this.broadcastDamage(target.id, target.hp, target.maxHp);
    }
  }

  /**
   * Envia uma atualização de dano para todos os clientes.
   * @param targetId - ID do monstro
   * @param newHp - HP atual
   * @param maxHp - HP máximo
   */
  private broadcastDamage(targetId: string, newHp: number, maxHp: number): void {
    const msg = JSON.stringify({
      type: "damage",
      targetId,
      newHp,
      maxHp,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  /**
   * Envia uma mensagem de chat para todos os clientes conectados (broadcast).
   * @param senderName - Nome do remetente.
   * @param message - Texto da mensagem.
   * @param channel - Canal (ex: "local", "support", "community", "trade").
   */
  private broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    const formatted = `[${channel.toUpperCase()}] ${senderName}: ${message}`;
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", message: formatted }));
      }
    }
  }

  /**
   * Envia uma atualização de posição de uma entidade para **todos** os clientes,
   * exceto o próprio remetente (opcional).
   * @param entityId - ID da entidade (jogador, monstro, etc.)
   * @param x - Nova coordenada X.
   * @param y - Nova coordenada Y.
   * @param excludeSocket - WebSocket a ser excluído do broadcast (ex: próprio jogador).
   */
  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    for (const [socket] of this.clients.entries()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  /**
   * Envia uma mensagem de spawn de um monstro para todos os clientes.
   */
  /**
   * Envia uma mensagem de spawn para todos os clientes.
   * @param monster - Monstro recém‑criado (respawnado)
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
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  /**
   * Envia uma mensagem de despawn para todos os clientes.
   * @param entityId - ID da entidade a ser removida
   */
  private broadcastDespawn(entityId: string): void {
    const msg = JSON.stringify({ type: "despawn", id: entityId });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  /**
   * Envia uma mensagem de chat para um jogador específico.
   * @param playerId - ID do jogador destino.
   * @param message - Mensagem a ser enviada.
   */
  public sendChatToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", message }));
        break;
      }
    }
  }

  /**
   * Retorna a instância singleton do WebSocketServer.
   */
  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }
}
