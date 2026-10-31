/**
 * index.ts
 *
 * Registry de handlers mapeando o tipo da mensagem para a função handler.
 *
 * @module network/handlers
 */

import { WebSocket } from "ws";
import { HandlerContext } from "./HandlerContext";
import { Player } from "../../game/entities/player";

// Importa todos os handlers
import { handleMove, handleMoveDir } from "./move.handler";
import { handleChat } from "./chat.handler";
import { handleAttack, handleStartAutoAttack, handleStopAutoAttack } from "./attack.handler";
import { handleLoot, handleTakeLoot } from "./loot.handler";
import {
  handleUseItem,
  handleEquipItem,
  handleUnequipItem,
  handleDropItem,
  handlePickupItem,
} from "./inventory.handler";
import { handleOpenShop, handleBuyItem, handleSellItem, handleCloseShop } from "./shop.handler";
import { handleOpenBank, handleDeposit, handleWithdraw, handleCloseBank } from "./bank.handler";

/**
 * Tipo de função handler.
 * Recebe o WebSocket, o jogador, a mensagem tipada e o contexto.
 */
export type HandlerFn = (
  ws: WebSocket,
  player: Player,
  msg: any, // Mantém any aqui pois o registry é genérico
  ctx: HandlerContext,
) => Promise<void> | void;

/**
 * Registry de handlers mapeando o tipo da mensagem para a função handler.
 */
export const handlers: Record<string, HandlerFn> = {
  // Movimento
  move: handleMove,
  moveDir: handleMoveDir,

  // Chat
  chat: handleChat,

  // Combate
  attack: handleAttack,
  startAutoAttack: handleStartAutoAttack,
  stopAutoAttack: handleStopAutoAttack,

  // Loot
  loot: handleLoot,
  takeLoot: handleTakeLoot,

  // Inventário e equipamento
  useItem: handleUseItem,
  equipItem: handleEquipItem,
  unequipItem: handleUnequipItem,
  dropItem: handleDropItem,
  pickupItem: handlePickupItem,

  // Shop
  openShop: handleOpenShop,
  buyItem: handleBuyItem,
  sellItem: handleSellItem,
  closeShop: handleCloseShop,

  // Bank
  openBank: handleOpenBank,
  deposit: handleDeposit,
  withdraw: handleWithdraw,
  closeBank: handleCloseBank,
};
