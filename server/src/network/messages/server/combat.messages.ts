/**
 * Mensagens de combate enviadas pelo servidor.
 * @module messages/server/combat
 */

export interface ServerDamageMessage {
  type: "damage";
  targetId: string;
  newHp: number;
  maxHp: number;
  damage: number;
}

export interface ServerAttackFailedMessage {
  type: "attackFailed";
  reason: string;
}

export interface ServerMonsterDiedMessage {
  type: "monsterDied";
  monsterId: string;
}

export interface ServerAutoAttackStoppedMessage {
  type: "autoAttackStopped";
  reason: string;
  targetId?: string; // identifica o target que está sendo encerrado
}

export interface ServerAutoAttackStartedMessage {
  type: "autoAttackStarted";
  targetId: string;
}
