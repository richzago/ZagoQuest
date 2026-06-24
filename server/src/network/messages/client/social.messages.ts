/**
 * Mensagens sociais (chat, interação com NPCs) enviadas pelo cliente.
 * @module messages/client/social
 */

/**
 * Mensagem de chat ou comando.
 */
export interface ClientChatMessage {
  type: "chat";
  message: string;
}

/**
 * Abrir loja de um NPC.
 */
export interface ClientOpenShopMessage {
  type: "openShop";
  npcId: string;
}

/**
 * Comprar item na loja.
 */
export interface ClientBuyItemMessage {
  type: "buyItem";
  npcId: string;
  itemId: string;
  amount: number;
}

/**
 * Abrir banco.
 */
export interface ClientOpenBankMessage {
  type: "openBank";
  npcId: string;
}

/**
 * Depositar gold no banco.
 */
export interface ClientDepositMessage {
  type: "deposit";
  amount: number;
}

/**
 * Sacar gold do banco.
 */
export interface ClientWithdrawMessage {
  type: "withdraw";
  amount: number;
}
