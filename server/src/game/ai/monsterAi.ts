/**
 * monsterAi.ts
 *
 * Inteligência artificial para monstros.
 * Segue o fluxo: aggro → perseguição → fuga → ataque.
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
 * Fluxo de decisão:
 * 1. Procura alvo (Aggro) – busca por criaturas (Players)
 * 2. Perde alvo se muito longe
 * 3. Foge se HP baixo
 * 4. Ataca se estiver adjacente
 * 5. Caso contrário, persegue alvo
 *
 * @class MonsterAI
 * @param {MonsterAIConfig} [config={}] - Configurações opcionais (fleeHp, attackCooldown)
 *
 * @example
 * ```typescript
 * // Monstro normal
 * const ai = new MonsterAI();
 *
 * // Monstro com fuga em HP < 10 e cooldown de ataque de 1.5s
 * const fleeAI = new MonsterAI({ fleeHp: 10, attackCooldown: 1500 });
 * ```
 */
export class MonsterAI {
  constructor(private config: MonsterAIConfig = {}) {}

  /**
   * Atualiza o comportamento do monstro a cada tick do game loop.
   *
   * @param monster - O monstro que está sendo controlado
   * @param world - Referência ao mundo (para buscar jogadores e mover)
   * @returns {void}
   *
   * @example
   * // Chamado automaticamente pelo game loop
   * monster.ai.update(monster, world);
   *
   * @remarks
   * A IA executa as etapas na seguinte ordem:
   * 1. Se não tiver alvo, procura jogadores num raio de 6 tiles.
   * 2. Se o alvo estiver a mais de 10 tiles de distância, perde o alvo.
   * 3. Se o HP do monstro estiver abaixo do limite de fuga (fleeHp), foge.
   * 4. Se estiver adjacente ao alvo e o cooldown de ataque tiver passado, ataca.
   * 5. Caso contrário, persegue o alvo.
   * 6. Se não houver alvo, move-se aleatoriamente (wander).
   */
  update(monster: Monster, world: World): void {
    // =========================
    // AGGRO SYSTEM (pegar alvo)
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

    if (!monster.target) {
      this.randomMove(monster, world);
      return;
    }

    const target = monster.target;

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
    // FLEE SYSTEM
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
    // ATTACK SYSTEM (com CooldownManager)
    // =========================
    const attackCooldown = this.config.attackCooldown ?? monster.type.ai.attackCooldown ?? 1000;
    if (distanceToTarget <= 1 && monster.cooldownManager.isReady("attack", attackCooldown)) {
      // Aplica cooldown antes de atacar
      monster.cooldownManager.addCooldown("attack", attackCooldown);
      const damageMin = monster.type.combat.damageMin;
      const damageMax = monster.type.combat.damageMax;
      const damage = damageMin + Math.floor(Math.random() * (damageMax - damageMin + 1));
      CombatSystem.attack(monster, target, world);
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
   *
   * @param monster - O monstro
   * @param world - Mundo
   * @returns {void}
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
