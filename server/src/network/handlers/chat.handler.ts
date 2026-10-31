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
import { handleOpenBank } from "./bank.handler";
import { handleOpenShop } from "./shop.handler";

const GREETINGS = ["hi", "oi", "olá", "hello"];
const FAREWELLS = ["bye", "tchau"];

/**
 * Chat e clique compartilham os MESMOS handlers de autorização econômica.
 * Só há painel se o diálogo /hi encontrou um NPC livre e próximo.
 * A IA é pausada pelo NpcInteractionSystem.open, nunca pelo cliente.
 */
async function openNpcPanelAfterGreeting(
  ws: WebSocket,
  player: Player,
  ctx: HandlerContext,
): Promise<void> {
  const npc = ctx.world.npcs.find(
    (candidate) => candidate.isTalking && candidate.talkingToPlayerId === player.id,
  );
  if (!npc) return;

  if (npc.npcType === "banker") {
    await handleOpenBank(ws, player, { type: "openBank", npcId: npc.id }, ctx);
  } else if (npc.npcType === "merchant") {
    await handleOpenShop(ws, player, { type: "openShop", npcId: npc.id }, ctx);
  }
}

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

  // Interação com NPCs (sem barra).
  if (GREETINGS.includes(message) || FAREWELLS.includes(message)) {
    const greeting = GREETINGS.includes(message);
    const command = greeting ? "/hi" : "/bye";
    Logger.system(`[COMANDO NPC] ${command} de ${player.name}`);
    await processChatCommand(command, player, ctx.world);
    if (greeting) await openNpcPanelAfterGreeting(ws, player, ctx);
    return;
  }

  // Alias com barra reutilizam exatamente o mesmo fluxo (sem abrir sessão
  // diferente nem contornar validação por proximidade/ocupação).
  if (message.startsWith("/")) {
    await processChatCommand(message, player, ctx.world);
    if (GREETINGS.includes(message.slice(1))) {
      await openNpcPanelAfterGreeting(ws, player, ctx);
    }
    return;
  }

  // Mensagem normal - usa broadcast service
  // TODO: Remover 'any' quando o sistema de canais for tipado
  const channel = (player as any).currentChannel || "local";
  ChatSystem.sendToChannel(player, channel, message);
  ctx.broadcast.broadcastChat(player.name, message, channel);
}
