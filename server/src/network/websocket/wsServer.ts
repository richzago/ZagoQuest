import { Server as HttpServer } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws"; // ← renomeado
import { World } from "../../game/world/World";
import { Logger } from "../../game/core/logger/logger";

export class WebSocketServer {
  // ← sua classe continua com este nome
  private wss: WSServer; // ← usa o nome renomeado
  private world: World;

  constructor(server: HttpServer, world: World) {
    this.world = world;
    this.wss = new WSServer({ server }); // ← ok, um argumento
    this.init();
  }

  private init() {
    this.wss.on("connection", (ws: WebSocket, req: any) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);
      this.sendInitialState(ws);

      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "move") {
            this.handleMove(ws, msg);
          } else {
            Logger.warn(`Tipo desconhecido: ${msg.type}`);
          }
        } catch (err) {
          Logger.error(`Erro ao processar mensagem: ${err}`);
        }
      });

      ws.on("close", () => {
        Logger.system("Cliente desconectado");
      });
    });
  }

  private sendInitialState(ws: WebSocket) {
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

  private handleMove(ws: WebSocket, msg: any) {
    const player = this.world.players[0];
    if (!player) return;

    const { x, y } = msg;
    if (this.world.isPositionWalkable(x, y, player.id)) {
      player.position.x = x;
      player.position.y = y;
      // Logger.world(`Jogador ${player.name} movido para (${x}, ${y})`);
      ws.send(JSON.stringify({ type: "position", x, y }));
    } else {
      ws.send(JSON.stringify({ type: "position", x: player.position.x, y: player.position.y }));
      // Logger.world(`Movimento inválido para ${player.name} (${x}, ${y})`);
    }
  }
}
