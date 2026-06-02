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
export function registerEventListeners(): void {
  const eventSystem = EventSystem.getInstance();

  // MONSTER_DEATH → LOOT (morte do monstro gera loot, mas é um evento de jogo)
  eventSystem.on<MonsterDeathEventData>(GameEvent.MONSTER_DEATH, (data) => {
    Logger.loot(`Monstro ${data.monsterName} morreu em (${data.position.x}, ${data.position.y})`);
  });

  // COMBAT_KILL → COMBAT (quem matou quem)
  eventSystem.on<CombatKillEventData>(GameEvent.COMBAT_KILL, (data) => {
    Logger.combat(`${data.killerName} matou ${data.victimName}`);
  });

  // PLAYER_DEATH → SYSTEM (evento de morte do jogador, com informação do assassino)
  eventSystem.on<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, (data) => {
    Logger.system(
      `Jogador ${data.playerName} morreu${data.killerName ? ` por ${data.killerName}` : ""}`,
    );
  });

  // PLAYER_LEVEL_UP → SKILL (subiu de nível)
  eventSystem.on<PlayerLevelUpEventData>(GameEvent.PLAYER_LEVEL_UP, (data) => {
    Logger.skill(`${data.playerName} subiu do nível ${data.oldLevel} para ${data.newLevel}!`);
  });

  // PLAYER_GAIN_XP → SKILL (ganho de experiência)
  eventSystem.on<PlayerGainXpEventData>(GameEvent.PLAYER_GAIN_XP, (data) => {
    Logger.skill(`${data.playerName} ganhou ${data.amount} XP (total: ${data.newTotalXp})`);
  });

  // ITEM_PICKUP → LOOT (coleta de item)
  eventSystem.on<ItemPickupEventData>(GameEvent.ITEM_PICKUP, (data) => {
    Logger.loot(`${data.playerName} coletou ${data.amount}x ${data.itemId}`);
  });

  // COMBAT_DAMAGE → COMBAT (dano causado)
  eventSystem.on<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, (data) => {
    Logger.combat(
      `${data.attackerName} causou ${data.damage} de dano em ${data.targetName} (HP restante: ${data.targetHpAfter})`,
    );
  });
}
