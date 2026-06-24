/**
 * Mensagens relacionadas a entidades (spawn, movimento, despawn).
 * @module messages/server/entity
 */

export interface ServerInitMessage {
  type: "init";
  playerId: string;
  x: number;
  y: number;
}

export interface ServerSpawnMessage {
  type: "spawn";
  id: string;
  name: string;
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  npcType?: string; // para NPCs
  itemId?: string; // para itens no chão
  amount?: number; // para itens no chão
  isItem?: boolean; // true se for item no chão
}

export interface ServerMoveMessage {
  type: "move";
  id: string;
  x: number;
  y: number;
}

export interface ServerDespawnMessage {
  type: "despawn";
  id: string;
}

export interface ServerPositionMessage {
  type: "position";
  x: number;
  y: number;
}
