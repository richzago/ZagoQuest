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
  // Formato real enviado por InventorySender e lido pelo Unity EquipmentHandler.
  // O array permite serializar o Map<EquipmentSlot, itemId> de forma estável.
  items: Array<{ slot: string; itemId: string }>;
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
  xp: number;            // XP acumulado atual
  xpToNext: number;      // Limite absoluto de XP do próximo nível
  levelXp: number;       // XP dentro do nível atual
  levelXpToNext: number; // XP necessário dentro do nível
  lifetimeXp: number;    // Todo XP recebido durante a trajetória
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
