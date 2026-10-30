/**
 * eventListeners.ts
 *
 * Registra os listeners (observadores) de eventos do sistema.
 * Cada listener define uma reação a um evento específico, geralmente logando no canal apropriado.
 *
 * @module game/core/events/eventListeners
 */

import { EventSystem } from "./eventSystem";
import { Logger } from "../logger/logger";
import {
  CombatDamageEventData,
  CombatKillEventData,
  ItemPickupEventData,
  MonsterDeathEventData,
  PlayerDeathEventData,
  PlayerGainXpEventData,
  PlayerLevelUpEventData,
} from "../../../shared/interfaces/eventData.interface";
import {
  ConditionAppliedEventData,
  ConditionRemovedEventData,
  ConditionTickEventData,
} from "../../../shared/interfaces/conditionEventData.interface";
import { GameEvent } from "../../../shared/enums/gameEvent.enum";

/**
 * Registra todos os listeners de eventos usados pelo servidor.
 * Esta função deve ser chamada uma vez durante a inicialização do jogo.
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * // No main.ts
 * registerEventListeners();
 * ```
 */
let disposeRegisteredListeners: (() => void) | undefined;

/** Idempotent registration; the returned function removes all owned listeners. */
export function registerEventListeners(): () => void {
  if (disposeRegisteredListeners) return disposeRegisteredListeners;

  const eventSystem = EventSystem.getInstance();
  const removers: Array<() => void> = [];
  const on = <T>(event: string, callback: (data: T) => void): void => {
    eventSystem.on<T>(event, callback);
    removers.push(() => eventSystem.off<T>(event, callback));
  };

  // =========================
  // Eventos de monstros
  // =========================
  on<MonsterDeathEventData>(GameEvent.MONSTER_DEATH, (data) => {
    Logger.loot(`Monstro ${data.monsterName} morreu em (${data.position.x}, ${data.position.y})`);
  });

  // =========================
  // Eventos de combate
  // =========================
  on<CombatKillEventData>(GameEvent.COMBAT_KILL, (data) => {
    Logger.combat(`${data.killerName} matou ${data.victimName}`);
  });

  on<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, (data) => {
    Logger.combat(
      `${data.attackerName} causou ${data.damage} de dano em ${data.targetName} (HP restante: ${data.targetHpAfter})`,
    );
  });

  // =========================
  // Eventos do jogador
  // =========================
  on<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, (data) => {
    Logger.system(
      `Jogador ${data.playerName} morreu${data.killerName ? ` por ${data.killerName}` : ""}`,
    );
  });

  on<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, (data) => {
    Logger.skill(`${data.playerName} subiu do nível ${data.oldLevel} para ${data.newLevel}!`);
  });

  on<PlayerGainXpEventData>(GameEvent.PLAYER_GAIN_XP, (data) => {
    Logger.skill(`${data.playerName} ganhou ${data.amount} XP (acumulado: ${data.newTotalXp}; histórico: ${data.lifetimeXp})`);
  });

  // =========================
  // Eventos de inventário
  // =========================
  on<ItemPickupEventData>(GameEvent.ITEM_PICKUP, (data) => {
    Logger.loot(`${data.playerName} coletou ${data.amount}x ${data.itemId}`);
  });

  // =========================
  // Eventos de condições (efeitos)
  // =========================
  on<ConditionAppliedEventData>(GameEvent.CONDITION_APPLIED, (data) => {
    Logger.combat(
      `${data.targetName} foi afetado por ${data.conditionName} (duração: ${data.duration}ms)${data.sourceName ? ` por ${data.sourceName}` : ""}`,
    );
  });

  on<ConditionRemovedEventData>(GameEvent.CONDITION_REMOVED, (data) => {
    Logger.combat(
      `${data.targetName} não está mais sob efeito de ${data.conditionName}${data.sourceName ? ` (removido por ${data.sourceName})` : ""}`,
    );
  });

  on<ConditionTickEventData>(GameEvent.CONDITION_TICK, (data) => {
    Logger.combat(
      `${data.targetName} sofreu ${data.damage} de dano de ${data.damageType} (${data.conditionName})`,
    );
  });

  const dispose = (): void => {
    if (disposeRegisteredListeners !== dispose) return;
    for (const remove of removers) remove();
    disposeRegisteredListeners = undefined;
  };
  disposeRegisteredListeners = dispose;
  return dispose;
}
