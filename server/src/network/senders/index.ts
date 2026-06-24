import { WebSocket } from "ws";
import { CombatSender } from "./CombatSender";
import { InventorySender } from "./InventorySender";
import { LootSender } from "./LootSender";
import { ShopSender } from "./ShopSender";
import { BankSender } from "./BankSender";
import { ChatSender } from "./ChatSender";

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

// Re-exporta os senders individuais (opcional)
export { CombatSender, InventorySender, LootSender, ShopSender, BankSender, ChatSender };
