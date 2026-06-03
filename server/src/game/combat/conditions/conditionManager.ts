/**
 * conditionManager.ts
 *
 * Gerencia as condições ativas em uma entidade.
 *
 * @module game/combat/conditions/ConditionManager
 */

import { Creature } from "../../entities/creature";
import { Condition } from "./condition";
import { ConditionEffect } from "../../../shared/interfaces/condition.interface";
import { Logger } from "../../core/logger/logger";
import { ConditionRegistry } from "../../../data/items/conditions/conditionRegistry";

export class ConditionManager {
  private conditions: Map<string, Condition> = new Map(); // conditionId -> Condition
  private lastUpdate = Date.now();

  constructor(private owner: Creature) {}

  /**
   * Aplica uma condição à entidade.
   * Se a mesma condição já existir, reinicia a duração.
   * @param conditionId - ID da condição (ex: "poison")
   * @param duration - Duração opcional (ms)
   */
  apply(conditionId: string, duration?: number): void {
    const definition = ConditionRegistry.get(conditionId);
    const existing = this.conditions.get(conditionId);
    if (existing) {
      // Reinicia a duração
      existing.remainingTime = duration ?? definition.defaultDuration;
      existing.startTime = Date.now();
      Logger.combat(`${this.owner.name} já estava com ${definition.name}, duração renovada.`);
      return;
    }

    const condition = new Condition(definition, duration);
    this.conditions.set(conditionId, condition);
    condition.startPeriodicEffects(this.owner, this.onTick.bind(this));
    Logger.combat(`${this.owner.name} foi afetado por ${definition.name}.`);
  }

  /**
   * Remove uma condição ativa.
   */
  remove(conditionId: string): void {
    const condition = this.conditions.get(conditionId);
    if (!condition) return;
    condition.stopPeriodicEffects();
    this.conditions.delete(conditionId);
    Logger.combat(`${this.owner.name} não está mais sob efeito de ${condition.definition.name}.`);
  }

  /**
   * Atualiza todas as condições (chamado periodicamente no game loop).
   */
  update(): void {
    const now = Date.now();
    const delta = now - this.lastUpdate;
    this.lastUpdate = now;

    for (const [id, condition] of this.conditions) {
      const expired = condition.update(delta);
      if (expired) {
        this.remove(id);
      }
    }
  }

  /**
   * Aplica os efeitos de um tick (ex: dano periódico).
   */
  private onTick(effect: ConditionEffect, target: Creature): void {
    if (effect.type === "damage_over_time") {
      const damage = effect.amount ?? 0;
      const damageType = effect.damageType;
      // Aplica dano diretamente (futuro: usar CombatFormula com resistências)
      target.takeDamage(damage);
      Logger.combat(
        `${target.name} sofreu ${damage} de dano de ${effect.damageType} (${this.owner.name})`,
      );
      // TODO: emitir evento de dano
    }
    // Outros efeitos (stat modifiers) seriam aplicados em tempo real (não implementado agora)
  }

  /**
   * Verifica se a entidade possui uma condição ativa.
   */
  has(conditionId: string): boolean {
    return this.conditions.has(conditionId);
  }

  /**
   * Retorna a condição ativa (se existir).
   */
  get(conditionId: string): Condition | undefined {
    return this.conditions.get(conditionId);
  }

  /**
   * Retorna todas as condições ativas.
   */
  getAll(): Condition[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Limpa todas as condições (ex: quando o jogador morre).
   */
  clear(): void {
    for (const condition of this.conditions.values()) {
      condition.stopPeriodicEffects();
    }
    this.conditions.clear();
  }
}
