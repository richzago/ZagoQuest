/**
 * Handlers de movimentação: apenas recebem mensagens e enviam confirmações.
 * Regras de velocidade, distância e colisão ficam no MovementSystem.
 */
import type { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { HandlerContext } from "./HandlerContext";
import { MovementSystem, type MoveResult } from "../../game/systems/movementSystem";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";
import type { ClientMoveMessage, ClientMoveDirMessage } from "../messages";

/** Sempre envia a posição real; só transmite movimento aos outros se aceito. */
async function confirmMovement(
  ws: WebSocket,
  player: Player,
  ctx: HandlerContext,
  result: MoveResult,
): Promise<void> {
  const { x, y } = player.position;
  ctx.packetSender.combat.sendPosition(x, y);

  if (result !== "moved") return;

  ctx.broadcast.broadcastMove(player.id, x, y, ws);

  // O afastamento do NPC vale para WASD e para coordenadas igualmente.
  const npc = ctx.world.npcs.find(
    (candidate) => candidate.isTalking && candidate.talkingToPlayerId === player.id,
  );
  if (npc) {
    const distance = Math.abs(npc.position.x - x) + Math.abs(npc.position.y - y);
    if (distance > 2) {
      await processChatCommand("/bye", player, ctx.world);
      Logger.system(`[MOVEMENT] ${player.name} encerrou conversa com ${npc.name} (distância).`);
    }
  }
}

/** Movimento absoluto: aceita apenas um tile adjacente, não teleporte. */
export async function handleMove(
  ws: WebSocket,
  player: Player,
  msg: ClientMoveMessage,
  ctx: HandlerContext,
): Promise<void> {
  const result = MovementSystem.moveTo(player, ctx.world, msg.x, msg.y);
  await confirmMovement(ws, player, ctx, result);
}

/** Movimento direcional: aplica as mesmas regras de "move". */
export async function handleMoveDir(
  ws: WebSocket,
  player: Player,
  msg: ClientMoveDirMessage,
  ctx: HandlerContext,
): Promise<void> {
  const result = MovementSystem.moveDirection(player, ctx.world, msg.dir);
  await confirmMovement(ws, player, ctx, result);
}
