/**
 * chat.handler.ts
 *
 * Handlers relacionados ao chat e interação com NPCs.
 *
 * @module network/handlers/chat
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";
import { ChatSystem } from "../../game/chat/chatSystem";
import type { ClientChatMessage } from "../messages";

const INTERACTION_WORDS = ["hi", "oi", "olá", "hello", "bye", "tchau"];

/**
 * Processa mensagens de chat.
 */
export async function handleChat(
  ws: WebSocket,
  player: Player,
  msg: ClientChatMessage,
  ctx: HandlerContext,
): Promise<void> {
  let { message } = msg;
  message = message.trim().toLowerCase();

  // Interação com NPCs (sem barra)
  if (INTERACTION_WORDS.includes(message)) {
    const command = message === "bye" || message === "tchau" ? "/bye" : "/hi";
    Logger.system(`[COMANDO NPC] ${command} de ${player.name}`);
    await processChatCommand(command, player, ctx.world);
    return;
  }

  // Comandos (com barra)
  if (message.startsWith("/")) {
    await processChatCommand(message, player, ctx.world);
    return;
  }

  // Mensagem normal - usa broadcast service
  // TODO: Remover 'any' quando o sistema de canais for tipado
  const channel = (player as any).currentChannel || "local";
  ChatSystem.sendToChannel(player, channel, message);
  ctx.broadcast.broadcastChat(player.name, message, channel);
}
