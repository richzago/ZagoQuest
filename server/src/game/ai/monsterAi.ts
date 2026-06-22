/**
 * monsterAi.ts
 *
 * Inteligência artificial para monstros.
 * Segue o fluxo: aggro → perseguição → fuga → ataque.
 * Agora respeita um raio de afastamento máximo (wanderRadius) do ponto de spawn
 * e nunca ultrapassa os limites do mapa (utiliza World.isPositionWalkable).
 *
 * @module game/ai/MonsterAI
 */

import { CombatSystem } from "../combat/combatSystem";
import { Monster } from "../entities/monster";
import { World } from "../world/World";
import { Logger } from "../core/logger/logger";
import { Creature } from "../entities/creature";
import { MonsterAIConfig } from "../../shared/interfaces/combat.interface";

export class MonsterAI {
  constructor(private config: MonsterAIConfig = {}) {}

  update(monster: Monster, world: World): void {
    // Procura alvo (aggro) – raio 6 tiles
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

    // Se não tem alvo, anda aleatoriamente (respeitando raio de wander e limites)
    if (!monster.target) {
      this.randomMove(monster, world);
      return;
    }

    const target = monster.target;

    // Perda de alvo (>10 tiles de distância)
    const distanceToTarget =
      Math.abs(target.position.x - monster.position.x) +
      Math.abs(target.position.y - monster.position.y);
    if (distanceToTarget > 10) {
      Logger.ai(`😴 ${monster.name} perdeu o alvo`);
      monster.target = undefined;
      return;
    }

    // Fuga (se HP baixo)
    const fleeHp = this.config.fleeHp ?? monster.type.ai.fleeHp;
    if (fleeHp !== undefined && monster.hp <= fleeHp) {
      const dx = monster.position.x - target.position.x;
      const dy = monster.position.y - target.position.y;
      const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
      const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      this.tryMove(monster, moveX, moveY, world);
      return;
    }

    // Ataque (se adjacente e cooldown ok)
    const attackCooldown = this.config.attackCooldown ?? monster.type.ai.attackCooldown ?? 1000;
    if (distanceToTarget <= 1 && monster.cooldownManager.isReady("attack", attackCooldown)) {
      monster.cooldownManager.addCooldown("attack", attackCooldown);
      CombatSystem.attack(monster, target, world);
      return;
    }

    // Perseguição
    const dx = target.position.x - monster.position.x;
    const dy = target.position.y - monster.position.y;
    const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
    const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
    this.tryMove(monster, moveX, moveY, world);
  }

  /**
   * Movimento aleatório quando não há alvo (wander).
   * Respeita o raio de wander e os limites do mundo.
   */
  private randomMove(monster: Monster, world: World): void {
    const radius = monster.wanderRadius ?? 3;
    const originX = monster.spawnX ?? monster.position.x;
    const originY = monster.spawnY ?? monster.position.y;
    const distToOrigin =
      Math.abs(monster.position.x - originX) + Math.abs(monster.position.y - originY);

    // Se já está no limite, força retorno ao centro
    if (distToOrigin >= radius) {
      const moveX = originX > monster.position.x ? 1 : -1;
      const moveY = originY > monster.position.y ? 1 : -1;
      this.tryMove(monster, moveX, moveY, world);
      return;
    }

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const move = directions[Math.floor(Math.random() * directions.length)];
    this.tryMove(monster, move.x, move.y, world);
  }

  /**
   * Tenta mover o monstro, verificando se a posição destino é caminhável e dentro do mapa.
   */
  private tryMove(monster: Monster, dx: number, dy: number, world: World): void {
    const newX = monster.position.x + dx;
    const newY = monster.position.y + dy;

    if (world.isPositionWalkable(newX, newY, monster.id)) {
      monster.position.x = newX;
      monster.position.y = newY;
    } else {
      // Log de movimento bloqueado (útil para debug, descomente se necessário)
      if (Math.random() < 0.1) {
        Logger.warn(`${monster.name} bloqueado de mover para (${newX}, ${newY})`);
      }
    }
  }
}
