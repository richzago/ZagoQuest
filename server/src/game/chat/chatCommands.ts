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
 * - /guild (ou /g) <comando> [args] → gerencia guildas (create, invite, accept, kick, leave, disband, info, members, promote, demote, setdesc, setprofile, setcover)
 * - /gmsg (ou /guildmsg) <mensagem> → envia mensagem para o chat da guilda (apenas membros)
 *
 * @module game/chat/chatCommands
 */

import { Player } from "../entities/player";
import { World } from "../world/World";
import { ChatSystem } from "./chatSystem";
import { Logger } from "../core/logger/logger";
import { GuildSystem } from "../systems/guildSystem";

/**
 * Processa uma linha de comando que começa com '/'.
 *
 * @param fullLine - Linha completa digitada pelo jogador (ex: "/s Olá mundo")
 * @param player - Jogador que enviou o comando
 * @param world - Referência ao mundo (necessário para obter lista de jogadores online, usado no /whisper)
 * @returns `true` se o comando foi reconhecido e executado, `false` caso contrário (não começa com '/')
 *
 * @remarks
 * A função não modifica o estado do mundo diretamente; delega para ChatSystem ou GuildSystem.
 * Se o comando for inválido ou com argumentos insuficientes, exibe uma mensagem de aviso.
 *
 * @example
 * ```typescript
 * // Exemplo de chamada (normalmente feita pelo chatReadline)
 * processChatCommand("/s Olá pessoal", player, world);
 * ```
 */
export function processChatCommand(fullLine: string, player: Player, world: World): boolean {
  if (!fullLine.startsWith("/")) return false;
  const parts = fullLine.slice(1).split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Suporte
  if (cmd === "s" || cmd === "support") {
    if (args.length === 0) {
      Logger.warn("Uso: /s <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "support", args.join(" "));
    return true;
  }

  // Comunidade
  if (cmd === "c" || cmd === "community") {
    if (args.length === 0) {
      Logger.warn("Uso: /c <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "community", args.join(" "));
    return true;
  }

  // Comércio
  if (cmd === "t" || cmd === "trade") {
    if (args.length === 0) {
      Logger.warn("Uso: /t <mensagem>");
      return true;
    }
    ChatSystem.sendToChannel(player, "trade", args.join(" "));
    return true;
  }

  // Privado
  if (cmd === "w" || cmd === "whisper") {
    if (args.length < 2) {
      Logger.warn("Uso: /w <jogador> <mensagem>");
      return true;
    }
    const targetName = args[0];
    const message = args.slice(1).join(" ");
    ChatSystem.sendPrivateMessage(player, targetName, message, world.players);
    return true;
  }

  // Denúncia
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

  // Chat da guilda
  if (cmd === "gmsg" || cmd === "guildmsg") {
    const message = args.join(" ");
    if (!message) {
      Logger.warn("Uso: /gmsg <mensagem>");
      return true;
    }
    GuildSystem.sendGuildMessage(player, message);
    return true;
  }

  // Guildas
  if (cmd === "guild" || cmd === "g") {
    const sub = args[0]?.toLowerCase();
    if (!sub) {
      Logger.warn(
        "Uso: /guild <create|invite|accept|kick|leave|disband|info|members|promote|demote|setdesc|setprofile|setcover>",
      );
      return true;
    }

    switch (sub) {
      case "create": {
        const guildName = args.slice(1).join(" ");
        if (!guildName) Logger.warn("Uso: /guild create <nome>");
        else GuildSystem.createGuild(player, guildName);
        break;
      }
      case "invite": {
        const targetName = args[1];
        if (!targetName) Logger.warn("Uso: /guild invite <jogador>");
        else GuildSystem.inviteToGuild(player, targetName);
        break;
      }
      case "accept":
        GuildSystem.acceptInvite(player);
        break;
      case "kick": {
        const targetName = args[1];
        if (!targetName) Logger.warn("Uso: /guild kick <jogador>");
        else GuildSystem.kickFromGuild(player, targetName);
        break;
      }
      case "leave":
        GuildSystem.leaveGuild(player);
        break;
      case "disband":
        GuildSystem.disbandGuild(player);
        break;
      case "info":
        GuildSystem.info(player);
        break;
      case "members": {
        const page = parseInt(args[1], 10) || 1;
        GuildSystem.listMembers(player, page);
        break;
      }
      case "promote": {
        const targetName = args[1];
        const newRole = args[2] as "vice" | "officer";
        if (!targetName || !newRole) Logger.warn("Uso: /guild promote <jogador> <vice|officer>");
        else GuildSystem.promote(player, targetName, newRole);
        break;
      }
      case "demote": {
        const targetName = args[1];
        if (!targetName) Logger.warn("Uso: /guild demote <jogador>");
        else GuildSystem.demote(player, targetName);
        break;
      }
      case "setdesc": {
        const description = args.slice(1).join(" ");
        if (!description) Logger.warn("Uso: /guild setdesc <descrição>");
        else GuildSystem.setDescription(player, description);
        break;
      }
      case "setprofile": {
        const url = args[1];
        if (!url) Logger.warn("Uso: /guild setprofile <url>");
        else GuildSystem.setProfileImage(player, url);
        break;
      }
      case "setcover": {
        const url = args[1];
        if (!url) Logger.warn("Uso: /guild setcover <url>");
        else GuildSystem.setCoverImage(player, url);
        break;
      }
      default:
        Logger.warn(
          "Comando de guilda inválido. Use: create, invite, accept, kick, leave, disband, info, members, promote, demote, setdesc, setprofile, setcover",
        );
    }
    return true;
  }

  Logger.warn(`Comando desconhecido: ${cmd}. Use /s, /c, /t, /w, /report, /guild, /gmsg`);
  return true;
}
