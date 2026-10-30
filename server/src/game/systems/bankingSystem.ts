/**
 * Transfers between the player's wallet and bank.
 * Transactions here are synchronous and only mutate state after ALL checks pass.
 */
import type { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { canCreditGold, isValidGoldBalance, isValidQuantity } from "./economyRules";

export class BankingSystem {
  /** Wallet -> bank. Rejects negative/fractional amounts and overflow. */
  static depositGold(player: Player, amount: number): boolean {
    if (!isValidQuantity(amount) || !isValidGoldBalance(player.gold) ||
        player.gold < amount || !canCreditGold(player.bankGold, amount)) return false;

    player.gold -= amount;
    player.bankGold += amount;
    Logger.economy(`${player.name} depositou ${amount} gold.`);
    return true;
  }

  /** Bank -> wallet. Same validation on both sides of the transfer. */
  static withdrawGold(player: Player, amount: number): boolean {
    if (!isValidQuantity(amount) || !isValidGoldBalance(player.bankGold) ||
        player.bankGold < amount || !canCreditGold(player.gold, amount)) return false;

    player.bankGold -= amount;
    player.gold += amount;
    Logger.economy(`${player.name} sacou ${amount} gold.`);
    return true;
  }

  static checkBalance(player: Player): void {
    Logger.economy(`Banco de ${player.name}: ${player.bankGold} gold; carteira: ${player.gold} gold.`);
  }
}
