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

/** Venda de itens do catálogo da sessão de comerciante. */
export interface ClientSellItemMessage {
  type: "sellItem";
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

/**
 * Fecha somente a sessão bancária do NPC informado.
 * O npcId impede que um painel antigo encerre a sessão de outro NPC.
 */
export interface ClientCloseBankMessage {
  type: "closeBank";
  npcId: string;
}

/** Fecha somente a loja atualmente aberta para este NPC. */
export interface ClientCloseShopMessage {
  type: "closeShop";
  npcId: string;
}
