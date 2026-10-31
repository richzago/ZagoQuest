/**
 * monsterAi.ts
 *
 * Inteligência artificial para monstros.
 * Segue o fluxo: aggro → perseguição → fuga → ataque.
 * Agora respeita um raio de afastamento máximo (wanderRadius) do ponto de spawn,
 * nunca ultrapassa os limites do mapa (utiliza World.isPositionWalkable)
 * e possui um cooldown de movimento para controlar a velocidade.
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
  // =========================
  // CONTROLE DE MOVIMENTO
  // =========================
  private lastMoveTime: number = 0;

  constructor(private config: MonsterAIConfig = {}) {}

  /**
   * stats.speed no JSON realmente influencia quantos tiles o monstro anda.
   * Rat/Goblin speed=20 => 1400ms/passo. Criaturas mais rápidas poderão
   * usar o mesmo parâmetro sem modificar o game loop nem o cliente.
   */
  private getMoveCooldown(monster: Monster): number {
    if (Number.isFinite(this.config.moveCooldown) && this.config.moveCooldown! > 0)
      return Math.max(100, this.config.moveCooldown!);
    const speed = monster.type.stats.speed;
    const resolved = Number.isFinite(speed) && speed! >= 0 ? speed! : 20;
    return Math.max(350, Math.min(1800, Math.floor(1800 - resolved * 20)));
  }

  /**
   * Atualiza o comportamento do monstro a cada tick do game loop.
   */
  update(monster: Monster, world: World): void {
    // Uma criatura morta não pode voltar a perseguir ou atacar.
    if (monster.hp <= 0 || monster.deathProcessed) return;

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

    // Perseguição (movimento em direção ao alvo)
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
      { x: 1, y: 0 }, // direita
      { x: -1, y: 0 }, // esquerda
      { x: 0, y: 1 }, // cima
      { x: 0, y: -1 }, // baixo
    ];
    const move = directions[Math.floor(Math.random() * directions.length)];
    this.tryMove(monster, move.x, move.y, world);
  }

  /**
   * Tenta mover o monstro, verificando se a posição destino é caminhável,
   * dentro do mapa e se o cooldown de movimento foi respeitado.
   */
  private tryMove(monster: Monster, dx: number, dy: number, world: World): void {
    // ==========================================================
    // 1. VERIFICA COOLDOWN DE MOVIMENTO
    // ==========================================================
    const now = Date.now();
    if (now - this.lastMoveTime < this.getMoveCooldown(monster)) {
      // Ainda não pode se mover novamente
      return;
    }

    // ==========================================================
    // 2. CALCULA A NOVA POSIÇÃO
    // ==========================================================
    const newX = monster.position.x + dx;
    const newY = monster.position.y + dy;

    // ==========================================================
    // 3. VALIDA A POSIÇÃO (caminhável e dentro dos limites)
    // ==========================================================
    if (world.isPositionWalkable(newX, newY, monster.id)) {
      // Move o monstro
      monster.position.x = newX;
      monster.position.y = newY;
      // Atualiza o timestamp do último movimento
      this.lastMoveTime = now;
    } else {
      // Movimento bloqueado (opcional: log para depuração)
      if (Math.random() < 0.1) {
        Logger.warn(`${monster.name} bloqueado de mover para (${newX}, ${newY})`);
      }
    }
  }
}
