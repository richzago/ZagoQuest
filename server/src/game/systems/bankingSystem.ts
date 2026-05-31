import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { Logger } from "../core/logger/logger";

export class BankingSystem {
  /**
   * Deposita gold no banco
   */
  static depositGold(player: Player, amount: number): boolean {
    if (amount <= 0) {
      Logger.warn(`Quantidade inválida.`);
      return false;
    }
    if (player.gold < amount) {
      Logger.warn(`Você não tem ${amount} gold para depositar.`);
      return false;
    }
    player.gold -= amount;
    player.bankGold += amount;
    Logger.economy(`${player.name} depositou ${amount} gold. Saldo na conta: ${player.bankGold}`);
    return true;
  }

  /**
   * Saca gold do banco
   */
  static withdrawGold(player: Player, amount: number): boolean {
    if (amount <= 0) {
      Logger.economy(`Quantidade inválida.`);
      return false;
    }
    if (player.bankGold < amount) {
      Logger.economy(`Saldo insuficiente. Você tem ${player.bankGold} gold no banco.`);
      return false;
    }
    player.bankGold -= amount;
    player.gold += amount;
    Logger.economy(`${player.name} sacou ${amount} gold. Saldo restante: ${player.bankGold}`);
    return true;
  }

  /**
   * Exibe o saldo bancário
   */
  static checkBalance(player: Player): void {
    Logger.economy(`💰 Saldo bancário de ${player.name}: ${player.bankGold} gold`);
    Logger.economy(`💵 Gold em mãos: ${player.gold}`);
  }
}
