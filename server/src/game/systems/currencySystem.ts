/**
 * currencySystem.ts
 *
 * Gerencia a conversão de moedas físicas (itens) em valor numérico de gold.
 * Quando o jogador coleta uma moeda, ela é automaticamente convertida e o item não entra no inventário.
 *
 * As moedas suportadas são:
 * - gold_coin (valor 1)
 * - platinum_coin (valor 100)
 * - crystal_coin (valor 10.000)
 */

export const COIN_VALUES: Record<string, number> = {
  "currency/gold_coin": 1,
  "currency/platinum_coin": 100,
  "currency/crystal_coin": 10000,
};

/**
 * Verifica se um itemId corresponde a uma moeda conhecida.
 * @param itemId - ID do item (ex: "currency/gold_coin")
 * @returns true se for moeda, false caso contrário
 */
export function isCoin(itemId: string): boolean {
  return itemId in COIN_VALUES;
}

/**
 * Retorna o valor em gold de uma moeda.
 * @param itemId - ID da moeda
 * @returns Valor numérico (1, 100, 10000) ou 0 se não for moeda
 */
export function getCoinValue(itemId: string): number {
  return COIN_VALUES[itemId] || 0;
}
