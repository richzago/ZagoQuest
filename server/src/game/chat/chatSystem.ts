/**
 * chatSystem.ts
 *
 * Lógica de envio de mensagens para canais públicos, privadas e denúncias.
 * Utiliza o ChatLogger para persistência.
 *
 * @module game/chat/chatSystem
 */

import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { ChatMessageLog, ReportLog } from "../../shared/interfaces/chat.interface";
import { ChatLogger } from "./chatLogger";

export class ChatSystem {
  /**
   * Envia uma mensagem para um canal público (support, community, trade).
   *
   * @param player - Jogador remetente
   * @param channel - Nome do canal ('support', 'community', 'trade')
   * @param message - Texto da mensagem
   * @returns {void}
   *
   * @example
   * ```typescript
   * ChatSystem.sendToChannel(player, "support", "Estou com um bug!");
   * ```
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
   *
   * @param sender - Quem envia
   * @param targetName - Nome do destinatário
   * @param message - Texto da mensagem
   * @param allPlayers - Lista de todos os jogadores online (para encontrar o destinatário)
   * @returns {void}
   *
   * @example
   * ```typescript
   * ChatSystem.sendPrivateMessage(player, "Richard", "Olá!", world.players);
   * ```
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
  }

  /**
   * Registra uma denúncia de um jogador contra outro.
   *
   * @param reporter - Quem denuncia
   * @param reportedName - Nome do denunciado
   * @param reason - Motivo da denúncia
   * @returns {void}
   *
   * @example
   * ```typescript
   * ChatSystem.reportPlayer(player, "Hacker", "spamming and offensive language");
   * ```
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
