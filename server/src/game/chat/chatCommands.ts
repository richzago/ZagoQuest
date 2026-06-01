/**
 * chatCommands.ts
 *
 * Interpreta comandos de chat digitados pelo jogador que começam com '/'.
 *
 * Fluxo:
 * 1. O jogador pressiona '/' para entrar no modo chat (via chatReadline.ts).
 * 2. Digita uma linha como "/s Olá pessoal" e pressiona Enter.
 * 3. Esta função processa a linha, identifica o comando e executa a ação correspondente.
 *
 * Comandos suportados:
 * - /s (ou /support) <mensagem> → envia para o canal Suporte
 * - /c (ou /community) <mensagem> → envia para o canal Comunidade
 * - /t (ou /trade) <mensagem> → envia para o canal Comércio
 * - /w (ou /whisper) <jogador> <mensagem> → mensagem privada
 * - /report <jogador> <motivo> → registra uma denúncia (salva em arquivo)
 */

import { Player } from "../entities/player";
import { World } from "../world/world";
import { ChatSystem } from "./chatSystem";
import { Logger } from "../core/logger/logger";

/**
 * Processa uma linha de comando que começa com '/'.
 *
 * @param fullLine Linha completa digitada pelo jogador (ex: "/s Olá mundo")
 * @param player Jogador que enviou o comando
 * @param world Referência ao mundo (necessário para obter lista de jogadores online, usado no /whisper)
 * @returns true se o comando foi reconhecido e executado, false caso contrário (não começa com '/')
 *
 * @remarks
 * A função não modifica o estado do mundo diretamente; delega para ChatSystem.
 * Se o comando for inválido ou com argumentos insuficientes, exibe uma mensagem de aviso.
 */
export function processChatCommand(fullLine: string, player: Player, world: World): boolean {
  // Verifica se a linha realmente começa com '/' (deveria ser sempre verdade, mas por segurança)
  if (!fullLine.startsWith("/")) return false;

  // Remove a barra inicial e divide em partes: [comando, argumento1, argumento2, ...]
  const parts = fullLine.slice(1).split(" ");
  const cmd = parts[0].toLowerCase(); // ex: "s", "support", "w", etc.
  const args = parts.slice(1); // argumentos a partir do índice 1

  // =========================
  // Canal Suporte (/s ou /support)
  // =========================
  if (cmd === "s" || cmd === "support") {
    if (args.length === 0) {
      Logger.warn("Uso: /s <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "support", args.join(" "));
    return true;
  }

  // =========================
  // Canal Comunidade (/c ou /community)
  // =========================
  if (cmd === "c" || cmd === "community") {
    if (args.length === 0) {
      Logger.warn("Uso: /c <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "community", args.join(" "));
    return true;
  }

  // =========================
  // Canal Comércio (/t ou /trade)
  // =========================
  if (cmd === "t" || cmd === "trade") {
    if (args.length === 0) {
      Logger.warn("Uso: /t <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "trade", args.join(" "));
    return true;
  }

  // =========================
  // Mensagem privada (/w ou /whisper)
  // =========================
  if (cmd === "w" || cmd === "whisper") {
    if (args.length < 2) {
      Logger.warn("Uso: /w <jogador> <mensagem>");
      return true;
    }
    const targetName = args[0];
    const message = args.slice(1).join(" ");
    // Passa a lista de todos os jogadores online para que o ChatSystem encontre o destinatário
    ChatSystem.sendPrivateMessage(player, targetName, message, world.players);
    return true;
  }

  // =========================
  // Denúncia (/report)
  // =========================
  if (cmd === "report") {
    if (args.length < 2) {
      Logger.warn("Uso: /report <jogador> <motivo>");
      return true;
    }
    const reportedName = args[0];
    const reason = args.slice(1).join(" ");
    ChatSystem.reportPlayer(player, reportedName, reason);
    return true;
  }

  // =========================
  // Comando não reconhecido
  // =========================
  Logger.warn(`Comando desconhecido: ${cmd}. Use /s, /c, /t, /w, /report`);
  return true;
}
