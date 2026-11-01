/**
 * Mensagens de inventário e equipamento enviadas pelo cliente.
 * @module messages/client/inventory
 */

/**
 * Usar um item do inventário.
 */
export interface ClientOpenBagMessage {
  type: "openBag";
  /** ItemId da Bag diretamente dentro da janela atualmente aberta. */
  itemId: string;
}
export interface ClientCloseBagMessage { type: "closeBag"; }

export interface ClientUseItemMessage {
  type: "useItem";
  itemId: string;
}

/**
 * Equipar um item.
 */
export interface ClientEquipItemMessage {
  type: "equipItem";
  itemId: string;
}

/**
 * Desequipar um item de um slot.
 */
export interface ClientUnequipItemMessage {
  type: "unequipItem";
  slot: string; // EquipmentSlot em string (ex: 'head', 'armor')
}

/**
 * Dropar um item no chão.
 */
export interface ClientDropItemMessage {
  type: "dropItem";
  itemId: string;
  amount?: number;
  x: number;
  y: number;
  /** true apenas ao arrastar do slot de equipamento; evita tirar cópia errada. */
  fromEquipment?: boolean;
}

/**
 * Pegar um item do chão.
 */
export interface ClientPickupItemMessage {
  type: "pickupItem";
  itemId: string;
}

/**
 * Abrir loot de um cadáver.
 */
export interface ClientDropCorpseLootMessage {
  type: "dropCorpseLoot";
  corpseId: string;
  itemIndex: number;
  x: number;
  y: number;
}

/** Arrastar diretamente do cadáver para o chão (sem passar pela mochila). */
export interface ClientLootMessage {
  type: "loot";
  corpseId: string;
}

/**
 * Pegar item(s) do loot.
 */
export interface ClientTakeLootMessage {
  type: "takeLoot";
  corpseId: string;
  takeAll: boolean;
  itemIndex?: number;
}
