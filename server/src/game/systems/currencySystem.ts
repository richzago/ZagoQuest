// src/game/systems/currencySystem.ts
export const COIN_VALUES: Record<string, number> = {
  "currency/gold_coin": 1,
  "currency/platinum_coin": 100,
  "currency/crystal_coin": 10000,
};

export function isCoin(itemId: string): boolean {
  return itemId in COIN_VALUES;
}

export function getCoinValue(itemId: string): number {
  return COIN_VALUES[itemId] || 0;
}
