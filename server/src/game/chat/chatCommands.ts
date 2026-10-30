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
 * - /guild (ou /g) <comando> [args] → gerencia guildas (via GuildService)
 * - /gmsg (ou /guildmsg) <mensagem> → envia mensagem para o chat da guilda
 *
 * @module game/chat/chatCommands
 */

import { Player } from "../entities/player";
import { World } from "../world/World";
import { ChatSystem } from "./chatSystem";
import { Logger } from "../core/logger/logger";
import { GuildService } from "../../api/services/guildService";
import { Npc } from "../entities/npc";
import { NpcInteractionSystem } from "../systems/npcInteractionSystem";

/**
 * Processa uma linha de comando que começa com '/'.
 *
 * @param fullLine - Linha completa digitada pelo jogador (ex: "/s Olá mundo")
 * @param player - Jogador que enviou o comando
 * @param world - Referência ao mundo (necessário para obter lista de jogadores online, usado no /whisper)
 * @returns `true` se o comando foi reconhecido e executado, `false` caso contrário (não começa com '/')
 *
 * @remarks
 * A função agora é assíncrona porque os comandos de guilda acessam o banco de dados via GuildService.
 */
export async function processChatCommand(
  fullLine: string,
  player: Player,
  world: World,
): Promise<boolean> {
  if (!fullLine.startsWith("/")) return false;
  const parts = fullLine.slice(1).split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // =========================
  // Suporte
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
  // Comunidade
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
  // Comércio
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
  // Mensagem privada
  // =========================
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

  // =========================
  // Denúncia
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
  // Interação com NPC
  // =========================

  if (cmd === "hi" || cmd === "oi" || cmd === "olá" || cmd === "hello") {
    // Um novo cumprimento inicia outro contexto de diálogo. É necessário
    // abrir a janela da loja/banco novamente para autorizar transações.
    NpcInteractionSystem.close(player);
    Logger.warn(`Executando /hi para ${player.name}. NPCs próximos: ...`);
    // Procura o NPC mais próximo (em até 2 tiles)
    let closestNpc: Npc | null = null;
    let minDist = 3; // distância máxima para interagir
    for (const npc of world.npcs) {
      const dx = Math.abs(npc.position.x - player.position.x);
      const dy = Math.abs(npc.position.y - player.position.y);
      const dist = dx + dy;
      if (dist < minDist) {
        minDist = dist;
        closestNpc = npc;
      }
    }
    if (closestNpc && minDist <= 2) {
      if (closestNpc.isTalking && closestNpc.talkingToPlayerId !== player.id) {
        ChatSystem.sendPrivateMessage(
          player,
          player.name,
          `O NPC ${closestNpc.name} já está conversando com outro jogador.`,
          [player],
        );
      } else {
        closestNpc.isTalking = true;
        closestNpc.talkingToPlayerId = player.id;
        ChatSystem.sendPrivateMessage(player, player.name, closestNpc.message, [player]);
      }
    } else {
      ChatSystem.sendPrivateMessage(player, player.name, "Nenhum NPC próximo.", [player]);
    }
    return true;
  }

  if (cmd === "bye" || cmd === "tchau") {
    // Despedida revoga a autorização econômica mesmo sem NPC conversando.
    NpcInteractionSystem.close(player);
    // Procura NPC com o qual o jogador está conversando
    for (const npc of world.npcs) {
      if (npc.talkingToPlayerId === player.id) {
        npc.isTalking = false;
        npc.talkingToPlayerId = undefined;
        ChatSystem.sendPrivateMessage(player, player.name, `Você se despediu de ${npc.name}.`, [
          player,
        ]);
        break;
      }
    }
    return true;
  }

  // =========================
  // Chat da guilda
  // =========================
  if (cmd === "gmsg" || cmd === "guildmsg") {
    const message = args.join(" ");
    if (!message) {
      Logger.warn("Uso: /gmsg <mensagem>");
      return true;
    }
    await GuildService.sendGuildMessage(player.name, message);
    return true;
  }

  // =========================
  // Guildas
  // =========================
  if (cmd === "guild" || cmd === "g") {
    const sub = args[0]?.toLowerCase();
    if (!sub) {
      Logger.warn(
        "Uso: /guild <create|invite|accept|kick|leave|disband|info|members|promote|demote|setdesc|setprofile|setcover>",
      );
      return true;
    }

    try {
      switch (sub) {
        case "create": {
          const guildName = args[1];
          const description = args.slice(2).join(" ") || "Sem descrição";
          if (!guildName) {
            Logger.warn("Uso: /guild create <nome> [descrição]");
          } else {
            await GuildService.createGuild(player.name, guildName, description);
          }
          break;
        }
        case "invite": {
          const targetName = args[1];
          if (!targetName) Logger.warn("Uso: /guild invite <jogador>");
          else await GuildService.inviteToGuild(player.name, targetName);
          break;
        }
        case "accept":
          await GuildService.acceptInvite(player.name);
          break;
        case "kick": {
          const targetName = args[1];
          if (!targetName) Logger.warn("Uso: /guild kick <jogador>");
          else await GuildService.kickFromGuild(player.name, targetName);
          break;
        }
        case "leave":
          await GuildService.leaveGuild(player.name);
          break;
        case "disband":
          await GuildService.disbandGuild(player.name);
          break;
        case "info": {
          const guild = await GuildService.getPlayerGuild(player.name);
          if (!guild) {
            Logger.warn("Você não está em uma guilda.");
          } else {
            const totalMembers = guild.members?.length || 0;
            const leader = guild.members?.find((m) => m.role === "leader");
            const vice = guild.members?.find((m) => m.role === "vice");
            const officers = guild.members?.filter((m) => m.role === "officer") || [];
            Logger.system(`=== Guilda: ${guild.name} ===`);
            Logger.system(`ID: ${guild.id}`);
            Logger.system(`Criada em: ${new Date(guild.createdAt).toLocaleDateString()}`);
            Logger.system(`Membros: ${totalMembers}/100`);
            Logger.system(`Líder: ${leader?.characterName} (Level ${leader?.level})`);
            if (vice) Logger.system(`Vice-líder: ${vice.characterName} (Level ${vice.level})`);
            if (officers.length)
              Logger.system(
                `Oficiais: ${officers.map((o) => `${o.characterName} (${o.level})`).join(", ")}`,
              );
            if (guild.description) Logger.system(`Descrição: ${guild.description}`);
          }
          break;
        }
        case "members": {
          const page = parseInt(args[1], 10) || 1;
          const guild = await GuildService.getPlayerGuild(player.name);
          if (!guild) {
            Logger.warn("Você não está em uma guilda.");
          } else {
            const { data, total } = await GuildService.listMembers(guild.name, page);
            Logger.system(`=== Membros da guilda ${guild.name} (página ${page}) ===`);
            for (const m of data) {
              Logger.system(
                `${m.role.toUpperCase()}: ${m.characterName} (Level ${m.level}) - Último login: ${new Date(m.lastSeen).toLocaleDateString()}`,
              );
            }
            if (total > page * 10) {
              Logger.system(`Digite /guild members ${page + 1} para ver mais.`);
            }
          }
          break;
        }
        case "promote": {
          const targetName = args[1];
          const newRole = args[2] as "vice" | "officer";
          if (!targetName || !newRole) Logger.warn("Uso: /guild promote <jogador> <vice|officer>");
          else await GuildService.promote(player.name, targetName, newRole);
          break;
        }
        case "demote": {
          const targetName = args[1];
          if (!targetName) Logger.warn("Uso: /guild demote <jogador>");
          else await GuildService.demote(player.name, targetName);
          break;
        }
        case "setdesc": {
          const description = args.slice(1).join(" ");
          if (!description) Logger.warn("Uso: /guild setdesc <descrição>");
          else await GuildService.setDescription(player.name, description);
          break;
        }
        case "setprofile": {
          const url = args[1];
          if (!url) Logger.warn("Uso: /guild setprofile <url>");
          else await GuildService.setProfileImage(player.name, url);
          break;
        }
        case "setcover": {
          const url = args[1];
          if (!url) Logger.warn("Uso: /guild setcover <url>");
          else await GuildService.setCoverImage(player.name, url);
          break;
        }
        default:
          Logger.warn(
            "Comando de guilda inválido. Use: create, invite, accept, kick, leave, disband, info, members, promote, demote, setdesc, setprofile, setcover",
          );
      }
    } catch (err: any) {
      Logger.warn(err.message);
    }
    return true;
  }

  // =========================
  // Comando não reconhecido
  // =========================
  Logger.warn(`Comando desconhecido: ${cmd}. Use /s, /c, /t, /w, /report, /guild, /gmsg`);
  return true;
}
