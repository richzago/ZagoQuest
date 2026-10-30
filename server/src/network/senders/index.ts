import { WebSocket } from "ws";
import { CombatSender } from "./combatSender";
import { InventorySender } from "./inventorySender";
import { LootSender } from "./lootSender";
import { ShopSender } from "./shopSender";
import { BankSender } from "./bankSender";
import { ChatSender } from "./chatSender";
import { InitialStateSender } from "./initialStateSender";
import { PlayerStatsSender } from "./playerStatsSender";
import { WorldStateSender } from "./worldStateSender";

/**
 * Agrupa todos os senders para facilitar o uso.
 */
export class PacketSender {
  public combat: CombatSender;
  public inventory: InventorySender;
  public loot: LootSender;
  public shop: ShopSender;
  public bank: BankSender;
  public chat: ChatSender;

  constructor(ws: WebSocket) {
    this.combat = new CombatSender(ws);
    this.inventory = new InventorySender(ws);
    this.loot = new LootSender(ws);
    this.shop = new ShopSender(ws);
    this.bank = new BankSender(ws);
    this.chat = new ChatSender(ws);
  }
}

// Re-exporta os senders individuais (incluindo os novos)
export {
  CombatSender,
  InventorySender,
  LootSender,
  ShopSender,
  BankSender,
  ChatSender,
  InitialStateSender,
  PlayerStatsSender,
  WorldStateSender,
};
