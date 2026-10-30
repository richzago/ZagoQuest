/**
 * Ponto de entrada para todas as mensagens tipadas.
 * @module messages
 */

// Client messages - exporta todas as interfaces
export * from "./client/movement.messages";
export * from "./client/combat.messages";
export * from "./client/inventory.messages";
export * from "./client/social.messages";

// Server messages - exporta todas as interfaces
export * from "./server/entity.messages";
export * from "./server/combat.messages";
export * from "./server/inventory.messages";
export * from "./server/social.messages";

// Importações explícitas para criar uniões
import type {
  ClientMoveMessage,
  ClientMoveDirMessage,
  ClientAttackMessage,
  ClientStartAutoAttackMessage,
  ClientStopAutoAttackMessage,
  ClientUseItemMessage,
  ClientEquipItemMessage,
  ClientUnequipItemMessage,
  ClientDropItemMessage,
  ClientPickupItemMessage,
  ClientLootMessage,
  ClientTakeLootMessage,
  ClientChatMessage,
  ClientOpenShopMessage,
  ClientBuyItemMessage,
  ClientOpenBankMessage,
  ClientDepositMessage,
  ClientWithdrawMessage,
  ClientCloseBankMessage,
  ClientCloseShopMessage,
} from "./client";

import type {
  ServerInitMessage,
  ServerSpawnMessage,
  ServerMoveMessage,
  ServerDespawnMessage,
  ServerPositionMessage,
} from "./server/entity.messages";

import type {
  ServerDamageMessage,
  ServerAttackFailedMessage,
  ServerMonsterDiedMessage,
  ServerAutoAttackStoppedMessage,
  ServerAutoAttackStartedMessage,
} from "./server/combat.messages";

import type {
  ServerInventoryMessage,
  ServerEquipmentMessage,
  ServerPlayerStatsMessage,
  ServerGoldMessage,
  ServerItemUsedMessage,
  ServerUnequipResultMessage,
  ServerDropErrorMessage,
  ServerPickupErrorMessage,
  ServerLootWindowMessage,
  ServerLootTakenMessage,
  ServerLootErrorMessage,
} from "./server/inventory.messages";

import type {
  ServerChatMessage,
  ServerShopWindowMessage,
  ServerBuyResultMessage,
  ServerShopErrorMessage,
  ServerBankWindowMessage,
  ServerBankResultMessage,
  ServerBankErrorMessage,
} from "./server/social.messages";

/**
 * Union de todas as mensagens que o servidor pode receber do cliente.
 */
export type ClientMessage =
  | ClientMoveMessage
  | ClientMoveDirMessage
  | ClientAttackMessage
  | ClientStartAutoAttackMessage
  | ClientStopAutoAttackMessage
  | ClientUseItemMessage
  | ClientEquipItemMessage
  | ClientUnequipItemMessage
  | ClientDropItemMessage
  | ClientPickupItemMessage
  | ClientLootMessage
  | ClientTakeLootMessage
  | ClientChatMessage
  | ClientOpenShopMessage
  | ClientBuyItemMessage
  | ClientOpenBankMessage
  | ClientDepositMessage
  | ClientWithdrawMessage
  | ClientCloseBankMessage
  | ClientCloseShopMessage;

/**
 * Union de todas as mensagens que o servidor pode enviar ao cliente.
 */
export type ServerMessage =
  | ServerInitMessage
  | ServerSpawnMessage
  | ServerMoveMessage
  | ServerDespawnMessage
  | ServerPositionMessage
  | ServerDamageMessage
  | ServerAttackFailedMessage
  | ServerMonsterDiedMessage
  | ServerAutoAttackStoppedMessage
  | ServerAutoAttackStartedMessage
  | ServerInventoryMessage
  | ServerEquipmentMessage
  | ServerPlayerStatsMessage
  | ServerGoldMessage
  | ServerItemUsedMessage
  | ServerUnequipResultMessage
  | ServerDropErrorMessage
  | ServerPickupErrorMessage
  | ServerLootWindowMessage
  | ServerLootTakenMessage
  | ServerLootErrorMessage
  | ServerChatMessage
  | ServerShopWindowMessage
  | ServerBuyResultMessage
  | ServerShopErrorMessage
  | ServerBankWindowMessage
  | ServerBankResultMessage
  | ServerBankErrorMessage;
