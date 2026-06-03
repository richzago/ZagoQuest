/**
 * condition.ts
 *
 * Representa uma instância ativa de uma condição em uma entidade.
 * Controla o tempo restante e os efeitos periódicos (ex: dano ao longo do tempo).
 *
 * @module game/combat/conditions/Condition
 */

import {
  ConditionDefinition,
  ConditionEffect,
} from "../../../shared/interfaces/condition.interface";
import { Creature } from "../../entities/creature";

/**
 * Classe que representa uma condição ativa (poison, burn, stun, etc.).
 *
 * @remarks
 * Uma condição é criada a partir de uma definição estática (carregada de JSON).
 * Ela mantém seu tempo restante e pode iniciar efeitos periódicos (ex: dano a cada tick).
 *
 * @example
 * ```typescript
 * const def = ConditionRegistry.get("poison");
 * const condition = new Condition(def, 5000);
 * condition.startPeriodicEffects(target, onTick);
 * ```
 */
export class Condition {
  /** Definição estática da condição (nome, efeitos, duração padrão) */
  public readonly definition: ConditionDefinition;

  /** Tempo restante em milissegundos */
  public remainingTime: number;

  /** Timestamp de quando a condição foi aplicada (ms) */
  public startTime: number;

  /** Timer para efeitos periódicos (ex: damage over time) */
  private tickTimer?: NodeJS.Timeout;

  /**
   * Cria uma nova instância de condição.
   *
   * @param definition - Definição estática da condição
   * @param duration - Duração personalizada (ms). Se omitido, usa `definition.defaultDuration`.
   */
  constructor(definition: ConditionDefinition, duration?: number) {
    this.definition = definition;
    this.remainingTime = duration ?? definition.defaultDuration;
    this.startTime = Date.now();
  }

  /**
   * Indica se a condição já expirou.
   *
   * @returns `true` se o tempo restante for menor ou igual a zero.
   */
  get isExpired(): boolean {
    return this.remainingTime <= 0;
  }

  /**
   * Atualiza o tempo restante da condição.
   * Deve ser chamado periodicamente pelo `ConditionManager`.
   *
   * @param deltaMs - Tempo decorrido em milissegundos desde a última atualização
   * @returns `true` se a condição expirou após a atualização, `false` caso contrário
   *
   * @example
   * ```typescript
   * const expired = condition.update(100);
   * if (expired) manager.remove(conditionId);
   * ```
   */
  update(deltaMs: number): boolean {
    this.remainingTime -= deltaMs;
    return this.isExpired;
  }

  /**
   * Inicia os efeitos periódicos da condição (ex: dano a cada tick).
   *
   * @param target - Alvo da condição (a entidade que sofre os efeitos)
   * @param onTick - Callback invocado a cada tick, recebendo o efeito e o alvo
   * @returns {void}
   *
   * @remarks
   * Atualmente, suporta apenas um efeito `damage_over_time` por condição (simplificado).
   * O timer é automaticamente interrompido quando a condição expira.
   *
   * @example
   * ```typescript
   * condition.startPeriodicEffects(player, (effect, target) => {
   *   target.takeDamage(effect.amount);
   * });
   * ```
   */
  startPeriodicEffects(
    target: Creature,
    onTick: (effect: ConditionEffect, target: Creature) => void,
  ): void {
    for (const effect of this.definition.effects) {
      if (effect.type === "damage_over_time" && effect.tickInterval) {
        this.tickTimer = setInterval(() => {
          if (this.isExpired) {
            this.stopPeriodicEffects();
            return;
          }
          onTick(effect, target);
        }, effect.tickInterval);
        break; // suporta apenas um efeito DoT por condição (simplificado)
      }
    }
  }

  /**
   * Interrompe os efeitos periódicos da condição.
   *
   * @returns {void}
   *
   * @remarks
   * Deve ser chamado quando a condição é removida ou expira.
   */
  stopPeriodicEffects(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }
}
