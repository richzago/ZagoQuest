/**
 * attack.handler.ts
 *
 * Handlers relacionados ao combate e ataques.
 *
 * @module network/handlers/attack
 */

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
    ctx.packetSender.combat.sendAttackFailed("Alvo não encontrado");
    return;
  }

  // Verifica se o alvo está vivo
  if (target.hp <= 0) {
    ctx.packetSender.combat.sendAttackFailed("Alvo já está morto");
    return;
  }

  // Verifica distância
  const distance = Math.sqrt(
    Math.pow(player.position.x - target.position.x, 2) +
      Math.pow(player.position.y - target.position.y, 2),
  );

  if (distance > 1.5) {
    ctx.packetSender.combat.sendAttackFailed("Alvo muito longe");
    return;
  }

  // Executa o ataque
  const damageDealt = CombatSystem.attack(player, target, ctx.world);

  // Usa o broadcast service para notificar todos os clientes sobre o dano
  ctx.broadcast.broadcastDamage(target.id, target.hp, target.maxHp, damageDealt);

  // Envia o dano para o atacante
  ctx.packetSender.combat.sendDamage(target.id, target.hp, target.maxHp, damageDealt);

  // Se o monstro morreu, notifica todos
  if (target.hp <= 0) {
    ctx.broadcast.broadcastDespawn(target.id);
    ctx.packetSender.combat.sendMonsterDied(target.id);
    Logger.combat(`${player.name} matou ${target.name} (ID ${target.id})`);
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
  if (!target) {
    ctx.packetSender.combat.sendAutoAttackStopped("Alvo não encontrado");
    return;
  }

  if (target.hp <= 0) {
    ctx.packetSender.combat.sendAutoAttackStopped("Alvo já está morto");
    return;
  }

  // Verifica distância
  const distance = Math.sqrt(
    Math.pow(player.position.x - target.position.x, 2) +
      Math.pow(player.position.y - target.position.y, 2),
  );

  if (distance > 1.5) {
    ctx.packetSender.combat.sendAutoAttackStopped("Alvo muito longe");
    return;
  }

  // Define o alvo do auto attack
  player.currentTargetId = msg.targetId;
  Logger.combat(`[AUTO] ${player.name} iniciou ataque contra ${target.name} (ID ${target.id})`);

  // Notifica o cliente que o auto attack foi iniciado
  ctx.packetSender.combat.sendAutoAttackStarted(msg.targetId);
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
  ctx.packetSender.combat.sendAutoAttackStopped("Auto attack parado");
}
