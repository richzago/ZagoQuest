/**
 * Handlers de combate: recebem pedidos e encaminham ao PlayerAttackSystem.
 *
 * Não fazem broadcast de dano/despawn: CombatSystem emite COMBAT_DAMAGE,
 * DeathSystem emite MONSTER_DEATH, e CombatEventBridge traduz em WebSocket.
 */
import type { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { PlayerAttackSystem } from "../../game/combat/playerAttackSystem";
import type {
  ClientAttackMessage,
  ClientStartAutoAttackMessage,
  ClientStopAutoAttackMessage,
} from "../messages";

/** Executa um ataque manual; o evento gerado envia o dano apenas uma vez. */
export async function handleAttack(
  _ws: WebSocket,
  player: Player,
  msg: ClientAttackMessage,
  ctx: HandlerContext,
): Promise<void> {
  const target = ctx.world.monsters.find((monster) => monster.id === msg.targetId);
  const result = PlayerAttackSystem.tryAttack(player, target, ctx.world);
  if (!result.ok) {
    ctx.packetSender.combat.sendAttackFailed(result.reason);
    return;
  }

  Logger.combat(`[MANUAL] ${player.name} causou ${result.damage} de dano em ${target!.name}.`);
}

/** Seleciona alvo distante vivo; alcance é cobrado no tryAttack, nunca na seleção. */
export function handleStartAutoAttack(
  _ws: WebSocket,
  player: Player,
  msg: ClientStartAutoAttackMessage,
  ctx: HandlerContext,
): void {
  const target = ctx.world.monsters.find((monster) => monster.id === msg.targetId);
  const failure = PlayerAttackSystem.validateSelectableTarget(player, target, ctx.world);
  if (failure) {
    ctx.packetSender.combat.sendAutoAttackStopped(failure, msg.targetId);
    return;
  }

  player.currentTargetId = msg.targetId;
  Logger.combat(`[AUTO] ${player.name} iniciou ataque contra ${target!.name} (ID ${target!.id}).`);
  ctx.packetSender.combat.sendAutoAttackStarted(msg.targetId);
}

/** Encerra auto attack sem interferir no cooldown compartilhado. */
export function handleStopAutoAttack(
  _ws: WebSocket,
  player: Player,
  _msg: ClientStopAutoAttackMessage,
  ctx: HandlerContext,
): void {
  const previousTarget = player.currentTargetId;
  player.currentTargetId = undefined;
  Logger.combat(`[AUTO] ${player.name} encerrou alvo ${previousTarget ?? "(nenhum)"} por comando do cliente.`);
  ctx.packetSender.combat.sendAutoAttackStopped("Auto attack parado", previousTarget);
}
