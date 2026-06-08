import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Logger } from "../../game/core/logger/logger";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo (posição de entidades, spawn, despawn).
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private clients: WebSocket[] = []; // Lista de todos os clientes conectados

  /**
   * Construtor.
   * @param server - Servidor HTTP compartilhado (API + WebSocket)
   * @param world - Instância do mundo do jogo (contém jogadores, monstros, etc.)
   */
  constructor(server: HttpServer, world: World) {
    this.world = world;
    this.wss = new WSServer({ server });
    this.clients = [];
    this.init();
  }

  /**
   * Inicializa os handlers de eventos do WebSocket.
   */
  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      // Adiciona o cliente à lista de broadcast
      this.clients.push(ws);

      // Envia o estado inicial do jogador e de todas as entidades
      this.sendInitialState(ws);
      this.sendSpawnEntities(ws);

      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "move") {
            this.handleMove(ws, msg);
          } else {
            Logger.warn(`Tipo de mensagem desconhecido: ${msg.type}`);
          }
        } catch (err) {
          Logger.error(`Erro ao processar mensagem: ${err}`);
        }
      });

      ws.on("close", () => {
        Logger.system("Cliente desconectado");
        // Remove o cliente da lista de broadcast
        this.clients = this.clients.filter((c) => c !== ws);
      });
    });
  }

  /**
   * Envia ao cliente recém‑conectado a posição inicial do jogador.
   * @param ws - WebSocket do cliente.
   */
  private sendInitialState(ws: WebSocket): void {
    const player = this.world.players[0];
    if (player) {
      ws.send(
        JSON.stringify({
          type: "init",
          playerId: player.id,
          x: player.position.x,
          y: player.position.y,
        }),
      );
    }
  }

  /**
   * Envia ao cliente todos os monstros atualmente vivos no mundo.
   * @param ws - WebSocket do cliente.
   */
  private sendSpawnEntities(ws: WebSocket): void {
    console.log(`Enviando ${this.world.monsters.length} monstros`);
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
  }

  /**
   * Processa um comando de movimento enviado pelo cliente.
   * @param ws - WebSocket do cliente que enviou o comando.
   * @param msg - Objeto com `x` e `y` (posição desejada).
   */
  private handleMove(ws: WebSocket, msg: { x: number; y: number }): void {
    const player = this.world.players[0];
    if (!player) return;

    const { x, y } = msg;
    if (this.world.isPositionWalkable(x, y, player.id)) {
      player.position.x = x;
      player.position.y = y;
      ws.send(JSON.stringify({ type: "position", x, y }));
    } else {
      ws.send(JSON.stringify({ type: "position", x: player.position.x, y: player.position.y }));
    }
  }

  /**
   * Envia uma atualização de posição de uma entidade (monstro, outro jogador, etc.)
   * para **todos** os clientes conectados.
   * @param entityId - ID da entidade.
   * @param x - Nova coordenada X.
   * @param y - Nova coordenada Y.
   */
  public broadcastMove(entityId: number, x: number, y: number): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
}
