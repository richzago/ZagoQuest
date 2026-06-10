export interface MonsterDeathEventData {
  monsterId: string;
  monsterName: string;
  killerId?: string;
  killerName?: string;
  position: { x: number; y: number };
}

export interface MonsterSpawnEventData {
  monsterId: string;
  monsterName: string;
  position: { x: number; y: number };
}

export interface PlayerDeathEventData {
  playerId: string;
  playerName: string;
  killerId?: string;
  killerName?: string;
}

export interface PlayerLevelUpEventData {
  playerId: string;
  playerName: string;
  oldLevel: number;
  newLevel: number;
}

export interface PlayerGainXpEventData {
  playerId: string;
  playerName: string;
  amount: number;
  newTotalXp: number;
}

export interface ItemPickupEventData {
  playerId: string;
  playerName: string;
  itemId: string;
  amount: number;
}

export interface CombatDamageEventData {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  damage: number;
  targetHpAfter: number;
}

export interface CombatKillEventData {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
}
