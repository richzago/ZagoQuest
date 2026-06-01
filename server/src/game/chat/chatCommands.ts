/**
 * chatCommands.ts
 * Interpreta comandos de chat digitados pelo jogador (ex: /s mensagem).
 */

import { Player } from "../entities/player";
import { World } from "../world/world";
import { ChatSystem } from "./chatSystem";
import { Logger } from "../core/logger/logger";

/**
 * Processa uma linha de comando que começa com '/'.
 * @param fullLine Linha completa (ex: "/s Olá")
 * @param player Jogador que executou
 * @param world Referência ao mundo (para obter lista de jogadores)
 * @returns true se o comando foi reconhecido e executado
 */
export function processChatCommand(fullLine: string, player: Player, world: World): boolean {
  if (!fullLine.startsWith("/")) return false;

  const parts = fullLine.slice(1).split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "s":
    case "support":
      if (args.length === 0) {
        Logger.warn("Uso: /s <mensagem>");
        return true;
      }
      ChatSystem.sendToChannel(player, "support", args.join(" "));
      return true;

    case "c":
    case "community":
      if (args.length === 0) {
        Logger.warn("Uso: /c <mensagem>");
        return true;
      }
      ChatSystem.sendToChannel(player, "community", args.join(" "));
      return true;

    case "t":
    case "trade":
      if (args.length === 0) {
        Logger.warn("Uso: /t <mensagem>");
        return true;
      }
      ChatSystem.sendToChannel(player, "trade", args.join(" "));
      return true;

    case "w":
    case "whisper":
      if (args.length < 2) {
        Logger.warn("Uso: /w <jogador> <mensagem>");
        return true;
      }
      const targetName = args[0];
      const message = args.slice(1).join(" ");
      ChatSystem.sendPrivateMessage(player, targetName, message, world.players);
      return true;

    case "report":
      if (args.length < 2) {
        Logger.warn("Uso: /report <jogador> <motivo>");
        return true;
      }
      const reportedName = args[0];
      const reason = args.slice(1).join(" ");
      ChatSystem.reportPlayer(player, reportedName, reason);
      return true;

    default:
      Logger.warn(`Comando desconhecido: ${cmd}. Use /s, /c, /t, /w, /report`);
      return true;
  }
}
