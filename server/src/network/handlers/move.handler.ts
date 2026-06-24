/**
 * move.handler.ts
 *
 * Handlers relacionados ao movimento.
 *
 * @module network/handlers/move
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";

type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

const directionOffsets: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: 1 },
  south: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northeast: { dx: 1, dy: 1 },
  northwest: { dx: -1, dy: 1 },
  southeast: { dx: 1, dy: -1 },
  southwest: { dx: -1, dy: -1 },
};

/**
 * Processa movimento por coordenadas (legado - chat/click move).
 */
export async function handleMove(
  ws: WebSocket,
  player: Player,
  msg: { x: number; y: number },
  ctx: HandlerContext,
): Promise<void> {
  const { x, y } = msg;

  if (ctx.world.isPositionWalkable(x, y, player.id)) {
    player.position.x = x;
    player.position.y = y;
    ctx.packetSender.combat.sendPosition(x, y);

    // Usa broadcast service para notificar todos
    ctx.broadcast.broadcastMove(player.id, x, y, ws);
  } else {
    ctx.packetSender.combat.sendPosition(player.position.x, player.position.y);
  }

  const talkingNpc = ctx.world.npcs.find((n) => n.isTalking && n.talkingToPlayerId === player.id);
  if (talkingNpc) {
    const dx = Math.abs(talkingNpc.position.x - player.position.x);
    const dy = Math.abs(talkingNpc.position.y - player.position.y);
    if (dx + dy > 2) {
      await processChatCommand("/bye", player, ctx.world);
      Logger.warn(`Auto-bye: ${player.name} se afastou de ${talkingNpc.name}`);
    }
  }
}

/**
 * Processa movimento por direção (estilo Tibia – grid).
 */
export function handleMoveDir(
  ws: WebSocket,
  player: Player,
  msg: { dir: Direction },
  ctx: HandlerContext,
): void {
  const { dir } = msg;
  const offset = directionOffsets[dir];
  if (!offset) {
    Logger.warn(`Direção inválida: ${dir}`);
    return;
  }

  const newX = player.position.x + offset.dx;
  const newY = player.position.y + offset.dy;

  if (ctx.world.isPositionWalkable(newX, newY, player.id)) {
    player.position.x = newX;
    player.position.y = newY;
    ctx.packetSender.combat.sendPosition(newX, newY);

    // Usa broadcast service para notificar todos
    ctx.broadcast.broadcastMove(player.id, newX, newY, ws);
  } else {
    ctx.packetSender.combat.sendPosition(player.position.x, player.position.y);
  }
}
