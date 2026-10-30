/**
 * Mensagens sociais (chat, loja, banco) enviadas pelo servidor.
 * @module messages/server/social
 */

export interface ServerChatMessage {
  type: "chat";
  message: string;
}

export interface ServerShopWindowMessage {
  type: "shopWindow";
  npcId: string;
  items: Array<{ itemId: string; name: string; price: number; stock: number }>;
}

export interface ServerBuyResultMessage {
  type: "buyResult";
  success: boolean;
  message: string;
}

export interface ServerShopErrorMessage {
  type: "shopError";
  message: string;
}

export interface ServerBankWindowMessage {
  type: "bankWindow";
  npcId: string;
  bankGold: number;
  gold: number; // Nome real do campo no BankSender e BankUI do Unity.
}

export interface ServerBankResultMessage {
  type: "bankResult";
  success: boolean;
  message: string;
  bankGold: number;
  gold: number; // Nome real do campo no BankSender e BankUI do Unity.
}

export interface ServerBankErrorMessage {
  type: "bankError";
  message: string;
}
