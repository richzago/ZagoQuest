import type { World } from "../../game/world/World";

export interface MonsterDeathEventData {
  /** Contexto interno (não serializado): isola notificações por mundo. */
  world?: World;
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
  newTotalXp: number; // XP acumulado atual
  lifetimeXp: number; // XP histórico recebido
}

export interface ItemPickupEventData {
  playerId: string;
  playerName: string;
  itemId: string;
  amount: number;
}

export interface CombatDamageEventData {
  /** Contexto interno (não serializado): isola notificações por mundo. */
  world?: World;
  targetMaxHp: number;
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
