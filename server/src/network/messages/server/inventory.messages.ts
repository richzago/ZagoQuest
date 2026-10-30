/**
 * Mensagens de inventário, equipamento e loot enviadas pelo servidor.
 * @module messages/server/inventory
 */

export interface ServerInventoryMessage {
  type: "inventory";
  gold: number;
  items: Array<{ itemId: string; amount: number }>;
}

export interface ServerEquipmentMessage {
  type: "equipment";
  slots: Record<string, string | null>; // slot -> itemId ou null
}

export interface ServerPlayerStatsMessage {
  type: "playerStats";
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  attack: number;
  defense: number;
  armor: number;
  xp: number;
  xpToNext: number;
  // Compatibilidade temporária com antigos consumidores.
  experience?: number;
  experienceToNext?: number;
}

export interface ServerGoldMessage {
  type: "gold";
  gold: number;
}

export interface ServerItemUsedMessage {
  type: "itemUsed";
  itemId: string;
  success: boolean;
  message: string;
}

export interface ServerUnequipResultMessage {
  type: "unequipResult";
  success: boolean;
  message: string;
}

export interface ServerDropErrorMessage {
  type: "dropError";
  message: string;
}

export interface ServerPickupErrorMessage {
  type: "pickupError";
  message: string;
}

export interface ServerLootWindowMessage {
  type: "lootWindow";
  corpseId: string;
  items: Array<{ itemId: string; amount: number; itemName: string }>;
}

export interface ServerLootTakenMessage {
  type: "lootTaken";
  corpseId: string;
  itemIndex?: number; // se definido, apenas um item foi removido
}

export interface ServerLootErrorMessage {
  type: "lootError";
  message: string;
}
