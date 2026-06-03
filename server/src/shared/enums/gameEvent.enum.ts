/**
 * gameEvent.enum.ts
 *
 * Eventos globais do sistema, usados pelo EventSystem para comunicação entre módulos.
 * Cada evento carrega dados específicos (definidos em `eventData.interface.ts`).
 *
 * @module shared/enums/GameEvent
 */

export enum GameEvent {
  // =========================
  // Eventos de monstros
  // =========================
  /** Disparado quando um monstro morre */
  MONSTER_DEATH = "monster:death",

  /** Disparado quando um monstro é spawnado no mundo */
  MONSTER_SPAWN = "monster:spawn",

  // =========================
  // Eventos do jogador
  // =========================
  /** Disparado quando o jogador morre */
  PLAYER_DEATH = "player:death",

  /** Disparado quando o jogador sobe de nível */
  PLAYER_LEVEL_UP = "player:levelUp",

  /** Disparado quando o jogador ganha experiência (XP) */
  PLAYER_GAIN_XP = "player:gainXp",

  // =========================
  // Eventos de inventário e itens
  // =========================
  /** Disparado quando um item é coletado (adicionado ao inventário) */
  ITEM_PICKUP = "item:pickup",

  /** Disparado quando um item é dropado (removido do inventário para o chão) */
  ITEM_DROP = "item:drop",

  /** Disparado quando um item é usado (consumido/equipado) */
  ITEM_USE = "item:use",

  // =========================
  // Eventos de combate
  // =========================
  /** Disparado quando um ataque causa dano */
  COMBAT_DAMAGE = "combat:damage",

  /** Disparado quando uma entidade é morta */
  COMBAT_KILL = "combat:kill",

  // Conditions
  CONDITION_APPLIED = "condition:applied",
  CONDITION_REMOVED = "condition:removed",
  CONDITION_TICK = "condition:tick",
}
