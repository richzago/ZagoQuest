/**
 * monsterAi.ts
 *
 * Inteligência artificial para monstros.
 * Segue o fluxo: aggro → perseguição → fuga → ataque.
 * Agora respeita um raio de afastamento máximo (wanderRadius) do ponto de spawn.
 *
 * @module game/ai/MonsterAI
 */

import { CombatSystem } from "../combat/combatSystem";
import { Monster } from "../entities/monster";
import { World } from "../world/World";
import { Logger } from "../core/logger/logger";
import { Creature } from "../entities/creature";
import { MonsterAIConfig } from "../../shared/interfaces/combat.interface";

/**
 * IA padrão dos monstros.
 *
 * @class MonsterAI
 * @param config - Configurações opcionais (fleeHp, attackCooldown)
 */
export class MonsterAI {
  constructor(private config: MonsterAIConfig = {}) {}

  /**
   * Atualiza o comportamento do monstro a cada tick do game loop.
   */
  update(monster: Monster, world: World): void {
    // =========================
    // 1. Procura alvo (aggro) – raio 6 tiles
    // =========================
    if (!monster.target) {
      const nearbyPlayers = world.getPlayersInRange(
        monster.position.x,
        monster.position.y,
        6,
      ) as Creature[];

      if (nearbyPlayers.length > 0) {
        monster.target = nearbyPlayers[0];
        Logger.ai(`👀 ${monster.name} encontrou ${monster.target.name}`);
      }
    }

    // Se não tem alvo, anda aleatoriamente (respeitando raio de wander)
    if (!monster.target) {
      this.randomMove(monster, world);
      return;
    }

    const target = monster.target;

    // =========================
    // 2. Perda de alvo (>10 tiles de distância)
    // =========================
    const distanceToTarget =
      Math.abs(target.position.x - monster.position.x) +
      Math.abs(target.position.y - monster.position.y);

    if (distanceToTarget > 10) {
      Logger.ai(`😴 ${monster.name} perdeu o alvo`);
      monster.target = undefined;
      return;
    }

    // =========================
    // 3. Fuga (se HP baixo)
    // =========================
    const fleeHp = this.config.fleeHp ?? monster.type.ai.fleeHp;
    if (fleeHp !== undefined && monster.hp <= fleeHp) {
      const dx = monster.position.x - target.position.x;
      const dy = monster.position.y - target.position.y;
      const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
      const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      monster.move(moveX, moveY, world);
      return;
    }

    // =========================
    // 4. Ataque (se adjacente e cooldown ok)
    // =========================
    const attackCooldown = this.config.attackCooldown ?? monster.type.ai.attackCooldown ?? 1000;
    if (distanceToTarget <= 1 && monster.cooldownManager.isReady("attack", attackCooldown)) {
      monster.cooldownManager.addCooldown("attack", attackCooldown);
      CombatSystem.attack(monster, target, world);
      return;
    }

    // =========================
    // 5. Perseguição
    // =========================
    const dx = target.position.x - monster.position.x;
    const dy = target.position.y - monster.position.y;
    const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
    const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
    monster.move(moveX, moveY, world);
  }

  /**
   * Movimento aleatório usado quando não há alvo (wander).
   * Respeita o raio de deslocamento (wanderRadius) definido no Tiled (ou padrão 3).
   *
   * @param monster - O monstro
   * @param world - Mundo
   */
  private randomMove(monster: Monster, world: World): void {
    // Usa o raio de wander (armazenado no monstro) ou padrão 3
    const radius = monster.wanderRadius ?? 3;

    // Calcula distância Manhattan ao ponto de origem
    const originX = monster.spawnX ?? monster.position.x;
    const originY = monster.spawnY ?? monster.position.y;
    const distToOrigin =
      Math.abs(monster.position.x - originX) + Math.abs(monster.position.y - originY);

    // Se já está no limite, força retorno ao centro
    if (distToOrigin >= radius) {
      const moveX = originX > monster.position.x ? 1 : -1;
      const moveY = originY > monster.position.y ? 1 : -1;
      monster.move(moveX, moveY, world);
      return;
    }

    // Movimento aleatório (apenas horizontal/vertical)
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const move = directions[Math.floor(Math.random() * directions.length)];
    monster.move(move.x, move.y, world);
  }
}
