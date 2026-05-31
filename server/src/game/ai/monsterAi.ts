import { CombatSystem } from "../combat/combatSystem";
import { MonsterAIConfig } from "./monsterAiConfig";
import { Monster } from "../entities/monster";
import { World } from "../world/world";
import { Logger } from "../core/logger/logger";
import { Creature } from "../entities/creature";

/**
 * IA padrão dos monstros.
 *
 * Fluxo de decisão:
 * 1. Procura alvo (Aggro) – busca por criaturas (Players)
 * 2. Perde alvo se muito longe
 * 3. Foge se HP baixo
 * 4. Ataca se estiver adjacente
 * 5. Caso contrário, persegue alvo
 */
export class MonsterAI {
  constructor(private config: MonsterAIConfig = {}) {}

  /**
   * Atualiza o comportamento do monstro a cada tick do game loop.
   */
  update(monster: Monster, world: World): void {
    // =========================
    // AGGRO SYSTEM (pegar alvo)
    // =========================
    if (!monster.target) {
      // Busca jogadores (Creature) em um raio de 6 tiles
      const nearbyPlayers = world.getPlayersInRange(
        monster.position.x,
        monster.position.y,
        6,
      ) as Creature[]; // getPlayersInRange retorna Damageable[], mas sabemos que são Players (Creature)

      if (nearbyPlayers.length > 0) {
        monster.target = nearbyPlayers[0];
        Logger.ai(`👀 ${monster.name} encontrou ${monster.target.name}`);
      }
    }

    // Se ainda não tem alvo, move aleatoriamente
    if (!monster.target) {
      this.randomMove(monster, world);
      return;
    }

    const target = monster.target; // agora target é Creature (não undefined)

    // =========================
    // TARGET LOSS SYSTEM
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
    // FLEE SYSTEM (prioridade alta)
    // =========================
    const fleeHp = this.config.fleeHp ?? monster.type.ai.fleeHp;
    if (fleeHp !== undefined && monster.hp <= fleeHp) {
      // Foge na direção oposta ao alvo
      const dx = monster.position.x - target.position.x;
      const dy = monster.position.y - target.position.y;
      const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
      const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      monster.move(moveX, moveY, world);
      return;
    }

    // =========================
    // ATTACK SYSTEM
    // =========================
    const attackCooldown = this.config.attackCooldown ?? monster.type.ai.attackCooldown ?? 1000;
    const now = Date.now();
    const canAttack = now - monster.lastAttackTime >= attackCooldown;

    if (distanceToTarget <= 1) {
      if (canAttack) {
        // Dano calculado a partir do JSON do monstro
        const damageMin = monster.type.combat.damageMin;
        const damageMax = monster.type.combat.damageMax;
        const damage = damageMin + Math.floor(Math.random() * (damageMax - damageMin + 1));
        CombatSystem.attack(monster, target, world);
        monster.lastAttackTime = now;
      }
      return;
    }

    // =========================
    // CHASE SYSTEM
    // =========================
    const dx = target.position.x - monster.position.x;
    const dy = target.position.y - monster.position.y;
    const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
    const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
    monster.move(moveX, moveY, world);
  }

  /**
   * Movimento aleatório usado quando não há alvo (wander).
   */
  private randomMove(monster: Monster, world: World): void {
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
