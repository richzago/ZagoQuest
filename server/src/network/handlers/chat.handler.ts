import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";
import { ChatSystem } from "../../game/chat/chatSystem";

/**
 * Palavras de interação com NPCs (sem barra).
 */
const INTERACTION_WORDS = ["hi", "oi", "olá", "hello", "bye", "tchau"];

/**
 * Processa mensagens de chat enviadas pelo cliente.
 * Suporta:
 * - Mensagens normais (canal local)
 * - Comandos (/hi, /bye, /trade, /support, /guild, etc.)
 * - Interação com NPCs (hi, oi, olá, hello, bye, tchau)
 */
export async function handleChat(
  ws: WebSocket,
  player: Player,
  msg: { message: string },
  ctx: HandlerContext,
): Promise<void> {
  let { message } = msg;
  message = message.trim().toLowerCase();

  // =========================
  // 1. INTERAÇÃO COM NPCs (sem barra)
  // =========================
  if (INTERACTION_WORDS.includes(message)) {
    const command = message === "bye" || message === "tchau" ? "/bye" : "/hi";
    Logger.system(`[COMANDO NPC] ${command} de ${player.name}`);
    await processChatCommand(command, player, ctx.world);
    return;
  }

  // =========================
  // 2. COMANDOS DO CHAT (com barra)
  // =========================
  if (message.startsWith("/")) {
    await processChatCommand(message, player, ctx.world);
    return;
  }

  // =========================
  // 3. MENSAGEM NORMAL (canal atual)
  // =========================
  const channel = (player as any).currentChannel || "local";
  ChatSystem.sendToChannel(player, channel, message);
  ctx.wsServer.broadcastChat(player.name, message, channel);
}
