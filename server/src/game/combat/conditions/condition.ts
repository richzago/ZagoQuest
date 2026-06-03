/**
 * condition.ts
 *
 * Representa uma instância ativa de uma condição em uma entidade.
 *
 * @module game/combat/conditions/Condition
 */

import {
  ConditionDefinition,
  ConditionEffect,
} from "../../../shared/interfaces/condition.interface";
import { Creature } from "../../entities/creature";

export class Condition {
  public readonly definition: ConditionDefinition;
  public remainingTime: number; // ms
  public startTime: number;
  private tickTimer?: NodeJS.Timeout;

  constructor(definition: ConditionDefinition, duration?: number) {
    this.definition = definition;
    this.remainingTime = duration ?? definition.defaultDuration;
    this.startTime = Date.now();
  }

  get isExpired(): boolean {
    return this.remainingTime <= 0;
  }

  /**
   * Atualiza o tempo restante (chamado periodicamente).
   * @returns true se a condição expirou.
   */
  update(deltaMs: number): boolean {
    this.remainingTime -= deltaMs;
    return this.isExpired;
  }

  /**
   * Inicia os efeitos periódicos (ex: damage over time).
   * @param target - Alvo da condição
   * @param onTick - Callback chamado a cada tick (para aplicar dano, etc.)
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

  stopPeriodicEffects(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }
}
