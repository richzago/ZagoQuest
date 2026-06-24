import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { CombatSystem } from "../../game/combat/combatSystem";

/**
 * Processa um ataque manual (tecla Espaço ou clique no monstro).
 */
export async function handleAttack(
  ws: WebSocket,
  player: Player,
  msg: { targetId: string },
  ctx: HandlerContext,
): Promise<void> {
  const target = ctx.world.monsters.find((m) => m.id === msg.targetId);
  if (!target) {
    Logger.warn(`Jogador ${player.name} tentou atacar monstro inexistente ${msg.targetId}`);
    return;
  }

  const damageDealt = CombatSystem.attack(player, target, ctx.world);

  if (target.hp <= 0) {
    ctx.wsServer.broadcastDespawn(target.id);
  } else {
    ctx.packetSender.combat.sendDamage(target.id, target.hp, target.maxHp, damageDealt);
  }
}

/**
 * Inicia o ataque automático contra um alvo.
 */
export function handleStartAutoAttack(
  ws: WebSocket,
  player: Player,
  msg: { targetId: string },
  ctx: HandlerContext,
): void {
  const target = ctx.world.monsters.find((m) => m.id === msg.targetId);
  if (!target || target.hp <= 0) {
    ctx.packetSender.combat.sendAutoAttackStopped("Alvo inválido ou morto");
    return;
  }
  player.currentTargetId = msg.targetId;
  Logger.combat(`[AUTO] ${player.name} iniciou ataque contra ${target.name} (ID ${target.id})`);
}

/**
 * Para o ataque automático.
 */
export function handleStopAutoAttack(
  ws: WebSocket,
  player: Player,
  _msg: any,
  ctx: HandlerContext,
): void {
  player.currentTargetId = undefined;
  Logger.combat(`${player.name} parou ataque automático`);
}
