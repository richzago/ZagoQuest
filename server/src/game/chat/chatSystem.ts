/**
 * chatSystem.ts
 *
 * Lógica de envio de mensagens para canais públicos, privadas e denúncias.
 * Utiliza o ChatLogger para persistência e o WebSocketServer para envio em tempo real.
 *
 * @module game/chat/chatSystem
 */

import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { ChatMessageLog, ReportLog } from "../../shared/interfaces/chat.interface";
import { ChatLogger } from "./chatLogger";
import { WebSocketServer } from "../../network/websocket/wsServer"; //

export class ChatSystem {
  /**
   * Envia uma mensagem para um canal público (support, community, trade).
   */
  static sendToChannel(player: Player, channel: string, message: string): void {
    const formatted = `[${channel.toUpperCase()}] ${player.name}: ${message}`;
    Logger.economy(formatted);

    const log: ChatMessageLog = {
      timestamp: new Date().toISOString(),
      playerName: player.name,
      playerLevel: player.level,
      channel,
      message,
    };
    ChatLogger.saveMessage(log);
  }

  /**
   * Envia uma mensagem privada de um jogador para outro.
   * Além de logar, também envia a mensagem via WebSocket para o destinatário.
   */
  static sendPrivateMessage(
    sender: Player,
    targetName: string,
    message: string,
    allPlayers: Player[],
  ): void {
    const target = allPlayers.find((p) => p.name.toLowerCase() === targetName.toLowerCase());
    if (!target) {
      Logger.warn(`Jogador ${targetName} não encontrado para mensagem privada de ${sender.name}.`);
      return;
    }

    const formatted = `[PRIVADO] ${sender.name} -> ${target.name}: ${message}`;
    Logger.economy(formatted);

    const log: ChatMessageLog = {
      timestamp: new Date().toISOString(),
      playerName: sender.name,
      playerLevel: sender.level,
      channel: "private",
      target: target.name,
      message,
    };
    ChatLogger.saveMessage(log);

    // 🔥 Envia a mensagem para o jogador alvo via WebSocket (se ele estiver online)
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.sendChatToPlayer(target.id, formatted);
    }
  }

  /**
   * Registra uma denúncia de um jogador contra outro.
   */
  static reportPlayer(reporter: Player, reportedName: string, reason: string): void {
    const report: ReportLog = {
      timestamp: new Date().toISOString(),
      reporterName: reporter.name,
      reporterLevel: reporter.level,
      reportedName,
      reason,
      status: "pending",
    };
    ChatLogger.saveReport(report);
    Logger.warn(
      `Denúncia registrada: ${reporter.name} denunciou ${reportedName} - Motivo: ${reason}`,
    );
  }
}
