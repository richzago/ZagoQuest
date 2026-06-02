/**
 * bankingSystem.ts
 *
 * Gerencia o banco do jogador: depósito, saque e consulta de saldo.
 * O gold armazenado no banco é separado do gold em mãos.
 *
 * As operações são registradas no canal ECONOMY do logger.
 *
 * @module game/systems/BankingSystem
 */

import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";

/**
 * Classe estática que contém as operações bancárias do jogador.
 *
 * @remarks
 * O gold do jogador é dividido em duas categorias:
 * - `player.gold`: dinheiro em mãos (usado para compras, transações diretas)
 * - `player.bankGold`: dinheiro armazenado no banco (seguro, usado para depósitos/saques)
 *
 * Todas as transações são registradas no canal `ECONOMY` do logger para auditoria.
 *
 * @example
 * ```typescript
 * // Depositar 100 gold
 * BankingSystem.depositGold(player, 100);
 *
 * // Sacar 50 gold
 * BankingSystem.withdrawGold(player, 50);
 *
 * // Verificar saldo
 * BankingSystem.checkBalance(player);
 * ```
 */
export class BankingSystem {
  /**
   * Deposita uma quantidade de gold da mochila do jogador para sua conta bancária.
   *
   * @param player - Jogador que está depositando
   * @param amount - Quantidade de gold a depositar (deve ser positiva)
   * @returns `true` se o depósito foi bem-sucedido, `false` caso contrário
   *
   * @remarks
   * A operação só é realizada se:
   * - A quantidade for maior que zero.
   * - O jogador tiver gold suficiente em mãos.
   *
   * Após o depósito, o gold é transferido de `player.gold` para `player.bankGold`.
   * Um log é gerado no canal `ECONOMY`.
   *
   * @example
   * ```typescript
   * if (BankingSystem.depositGold(player, 100)) {
   *   console.log("Depósito realizado com sucesso");
   * }
   * ```
   */
  static depositGold(player: Player, amount: number): boolean {
    // Validação: quantidade deve ser positiva
    if (amount <= 0) {
      Logger.warn(`Quantidade inválida.`);
      return false;
    }
    // Verifica se o jogador tem gold suficiente em mãos
    if (player.gold < amount) {
      Logger.warn(`Você não tem ${amount} gold para depositar.`);
      return false;
    }
    // Transfere o valor: mochila -> banco
    player.gold -= amount;
    player.bankGold += amount;
    Logger.economy(`${player.name} depositou ${amount} gold. Saldo na conta: ${player.bankGold}`);
    return true;
  }

  /**
   * Saca uma quantidade de gold da conta bancária para a mochila do jogador.
   *
   * @param player - Jogador que está sacando
   * @param amount - Quantidade de gold a sacar (deve ser positiva)
   * @returns `true` se o saque foi bem-sucedido, `false` caso contrário
   *
   * @remarks
   * A operação só é realizada se:
   * - A quantidade for maior que zero.
   * - O saldo bancário for suficiente.
   *
   * Após o saque, o gold é transferido de `player.bankGold` para `player.gold`.
   * Um log é gerado no canal `ECONOMY`.
   *
   * @example
   * ```typescript
   * if (BankingSystem.withdrawGold(player, 50)) {
   *   console.log("Saque realizado com sucesso");
   * }
   * ```
   */
  static withdrawGold(player: Player, amount: number): boolean {
    if (amount <= 0) {
      Logger.economy(`Quantidade inválida.`);
      return false;
    }
    // Verifica saldo bancário suficiente
    if (player.bankGold < amount) {
      Logger.economy(`Saldo insuficiente. Você tem ${player.bankGold} gold no banco.`);
      return false;
    }
    // Transfere o valor: banco -> mochila
    player.bankGold -= amount;
    player.gold += amount;
    Logger.economy(`${player.name} sacou ${amount} gold. Saldo restante: ${player.bankGold}`);
    return true;
  }

  /**
   * Exibe o saldo bancário e o gold em mãos do jogador.
   *
   * @param player - Jogador a ser consultado
   * @returns {void}
   *
   * @remarks
   * Apenas exibe informações no log, não altera nenhum dado.
   * Útil para comandos como `/balance` no futuro.
   *
   * @example
   * ```typescript
   * BankingSystem.checkBalance(player);
   * // Saída no log: 💰 Saldo bancário de Richard: 100 gold
   * //               💵 Gold em mãos: 50 gold
   * ```
   */
  static checkBalance(player: Player): void {
    Logger.economy(`💰 Saldo bancário de ${player.name}: ${player.bankGold} gold`);
    Logger.economy(`💵 Gold em mãos: ${player.gold}`);
  }
}
