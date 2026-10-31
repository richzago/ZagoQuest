/**
 * conditionManager.ts
 *
 * Gerencia as condições ativas em uma entidade (ex: poison, burn, stun, haste).
 * Responsável por aplicar, remover, atualizar e processar os efeitos periódicos.
 * Utiliza o EventSystem para notificar outros sistemas sobre mudanças nas condições.
 *
 * @module game/combat/conditions/ConditionManager
 */

import { Creature } from "../../entities/creature";
import { Condition } from "./condition";
import { ConditionEffect } from "../../../shared/interfaces/condition.interface";
import { Logger } from "../../core/logger/logger";
import { EventSystem } from "../../core/events/eventSystem";
import { GameEvent } from "../../../shared/enums/gameEvent.enum";
import {
  ConditionAppliedEventData,
  ConditionRemovedEventData,
  ConditionTickEventData,
} from "../../../shared/interfaces/conditionEventData.interface";
import { ConditionRegistry } from "../../../data/items/conditions/conditionRegistry";


/**
 * Gerencia as condições ativas de uma criatura.
 *
 * @remarks
 * Cada condição é identificada por seu ID (ex: "poison") e possui uma duração.
 * Se a mesma condição for aplicada novamente enquanto ativa, sua duração é reiniciada.
 * O gerenciador atualiza periodicamente o tempo restante e aplica os efeitos periódicos.
 *
 * @example
 * ```typescript
 * const manager = new ConditionManager(monster);
 * manager.apply("poison", 10000);
 * manager.update(); // deve ser chamado no game loop
 * ```
 */
export class ConditionManager {
  private conditions: Map<string, Condition> = new Map(); // conditionId -> Condition
  // Cada Condition controla seu próprio início: nenhum delta global aqui.
  private applyDamage?: (target: Creature, amount: number, source: Creature | undefined, conditionName: string) => number;

  constructor(private owner: Creature) {}

  /** Runtime wiring is supplied by World, avoiding a Creature → CombatSystem cycle. */
  bindDamage(handler: (target: Creature, amount: number, source: Creature | undefined, conditionName: string) => number): void {
    this.applyDamage = handler;
  }

  /**
   * Aplica uma condição à entidade.
   * Se a mesma condição já existir, reinicia a duração.
   *
   * @param conditionId - ID da condição (ex: "poison")
   * @param duration - Duração em milissegundos (opcional, usa o valor padrão da definição)
   * @param source - Entidade que causou a condição (opcional, para eventos)
   * @returns {void}
   *
   * @remarks
   * Dispara o evento `CONDITION_APPLIED` via `EventSystem`.
   *
   * @example
   * ```typescript
   * conditionManager.apply("poison", 5000, attacker);
   * ```
   */
  apply(conditionId: string, duration?: number, source?: Creature): void {
    const definition = ConditionRegistry.get(conditionId);
    const existing = this.conditions.get(conditionId);
    if (existing) {
      // Uma reaplicação também reinicia a fase do DoT; não herda um tick
      // prestes a disparar do efeito anterior.
      const refreshedDuration = duration ?? definition.defaultDuration;
      if (!Number.isSafeInteger(refreshedDuration) || refreshedDuration <= 0) return;
      existing.refresh(refreshedDuration);
      existing.source = source;
      existing.startPeriodicEffects(this.owner, (effect, target) =>
        this.onTick(existing, effect, target));
      Logger.combat(`${this.owner.name} já estava com ${definition.name}, duração renovada.`);
      return;
    }

    const durationMs = duration ?? definition.defaultDuration;
    if (!Number.isSafeInteger(durationMs) || durationMs <= 0) return;
    const condition = new Condition(definition, durationMs);
    condition.source = source;
    this.conditions.set(conditionId, condition);
    condition.startPeriodicEffects(this.owner, (effect: ConditionEffect, target: Creature) => this.onTick(condition, effect, target));

    // Emitir evento de condição aplicada
    const eventData: ConditionAppliedEventData = {
      targetId: this.owner.id,
      targetName: this.owner.name,
      conditionId: definition.id,
      conditionName: definition.name,
      duration: condition.remainingTime,
      sourceId: source?.id,
      sourceName: source?.name,
    };
    EventSystem.getInstance().emit(GameEvent.CONDITION_APPLIED, eventData);

    Logger.combat(`${this.owner.name} foi afetado por ${definition.name}.`);
  }

  /**
   * Remove uma condição ativa da entidade.
   *
   * @param conditionId - ID da condição a ser removida
   * @param source - Entidade que removeu a condição (opcional, para eventos)
   * @returns {void}
   *
   * @remarks
   * Dispara o evento `CONDITION_REMOVED` via `EventSystem`.
   *
   * @example
   * ```typescript
   * conditionManager.remove("poison");
   * ```
   */
  remove(conditionId: string, source?: Creature): void {
    const condition = this.conditions.get(conditionId);
    if (!condition) return;
    condition.stopPeriodicEffects();
    this.conditions.delete(conditionId);

    const eventData: ConditionRemovedEventData = {
      targetId: this.owner.id,
      targetName: this.owner.name,
      conditionId: condition.definition.id,
      conditionName: condition.definition.name,
      sourceId: source?.id,
      sourceName: source?.name,
    };
    EventSystem.getInstance().emit(GameEvent.CONDITION_REMOVED, eventData);

    Logger.combat(`${this.owner.name} não está mais sob efeito de ${condition.definition.name}.`);
  }

  /**
   * Atualiza todas as condições ativas (deve ser chamado periodicamente no game loop).
   *
   * @returns {void}
   *
   * @remarks
   * Atualiza o tempo restante de cada condição. Se alguma expirar, chama `remove()`.
   *
   * @example
   * ```typescript
   * setInterval(() => conditionManager.update(), 100);
   * ```
   */
  update(): void {
    const now = Date.now();
    for (const [id, condition] of this.conditions) {
      if (condition.update(now)) this.remove(id);
    }
  }

  /**
   * Callback chamado em cada tick de uma condição (ex: dano periódico).
   *
   * @param condition - A condição que está gerando o tick
   * @param effect - O efeito associado ao tick
   * @param target - O alvo da condição (geralmente o próprio `owner`)
   * @returns {void}
   *
   * @remarks
   * Atualmente suporta apenas efeitos do tipo `damage_over_time`.
   * Dispara o evento `CONDITION_TICK` via `EventSystem`.
   *
   * @private
   */
  private onTick(condition: Condition, effect: ConditionEffect, target: Creature): void {
    if (effect.type === "damage_over_time") {
      // Duração expirou entre game ticks: jamais aplicar dano "extra".
      if (this.conditions.get(condition.definition.id) !== condition) return;
      if (condition.isExpired) {
        this.remove(condition.definition.id);
        return;
      }
      // Detached creatures cannot produce death/XP/loot in a consistent World.
      if (!this.applyDamage || target.hp <= 0) return;
      const damageType = effect.damageType;
      const damage = this.applyDamage(
        target, effect.amount ?? 0, condition.source, condition.definition.name,
      );

      if (damage <= 0) return;
      const tickData: ConditionTickEventData = {
        targetId: target.id,
        targetName: target.name,
        conditionId: condition.definition.id,
        conditionName: condition.definition.name,
        damage,
        damageType,
      };
      EventSystem.getInstance().emit(GameEvent.CONDITION_TICK, tickData);

      Logger.combat(
        `${target.name} sofreu ${damage} de dano de ${damageType} (${condition.definition.name})`,
      );
    }
    // Futuro: outros tipos de efeito (stat modifiers, etc.) seriam implementados aqui
  }

  /**
   * Verifica se a entidade possui uma condição ativa.
   *
   * @param conditionId - ID da condição
   * @returns `true` se a condição está ativa, `false` caso contrário
   *
   * @example
   * ```typescript
   * if (conditionManager.has("poison")) {
   *   console.log("Está envenenado!");
   * }
   * ```
   */
  has(conditionId: string): boolean {
    return this.conditions.has(conditionId);
  }

  /**
   * Retorna a instância da condição ativa (se existir).
   *
   * @param conditionId - ID da condição
   * @returns A condição ativa ou `undefined` se não estiver presente
   */
  get(conditionId: string): Condition | undefined {
    return this.conditions.get(conditionId);
  }

  /**
   * Retorna todas as condições ativas.
   *
   * @returns Array de condições ativas
   */
  getAll(): Condition[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Remove todas as condições ativas (útil para quando a entidade morre).
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Quando o jogador morre
   * conditionManager.clear();
   * ```
   */
  clear(): void {
    for (const condition of this.conditions.values()) {
      condition.stopPeriodicEffects();
    }
    this.conditions.clear();
  }
}
