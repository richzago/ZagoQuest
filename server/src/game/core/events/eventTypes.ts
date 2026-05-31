/**
 * Lista de todos os eventos possíveis no sistema.
 */
export enum GameEvent {
  // Monstros
  MONSTER_DEATH = "monster:death",
  MONSTER_SPAWN = "monster:spawn",

  // Jogador
  PLAYER_DEATH = "player:death",
  PLAYER_LEVEL_UP = "player:levelUp",
  PLAYER_GAIN_XP = "player:gainXp",

  // Inventário / Itens
  ITEM_PICKUP = "item:pickup",
  ITEM_DROP = "item:drop",
  ITEM_USE = "item:use",

  // Combate
  COMBAT_DAMAGE = "combat:damage",
  COMBAT_KILL = "combat:kill",
}

// ---------- Dados específicos por evento ----------

export interface MonsterDeathEventData {
  monsterId: number;
  monsterName: string;
  killerId?: number;
  killerName?: string;
  position: { x: number; y: number };
}

export interface MonsterSpawnEventData {
  monsterId: number;
  monsterName: string;
  position: { x: number; y: number };
}

export interface PlayerDeathEventData {
  playerId: number;
  playerName: string;
  killerId?: number;
  killerName?: string;
}

export interface PlayerLevelUpEventData {
  playerId: number;
  playerName: string;
  oldLevel: number;
  newLevel: number;
}

export interface PlayerGainXpEventData {
  playerId: number;
  playerName: string;
  amount: number;
  newTotalXp: number;
}

export interface ItemPickupEventData {
  playerId: number;
  playerName: string;
  itemId: string;
  amount: number;
}

export interface CombatDamageEventData {
  attackerId: number;
  attackerName: string;
  targetId: number;
  targetName: string;
  damage: number;
  targetHpAfter: number;
}

export interface CombatKillEventData {
  killerId: number;
  killerName: string;
  victimId: number;
  victimName: string;
}
