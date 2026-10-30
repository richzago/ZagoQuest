/**
 * Regras comuns da economia. O servidor (não o Unity) valida cada operação.
 * Gold é persistido em uma coluna INT do PostgreSQL: máximo 2.147.483.647.
 */
export const MAX_GOLD = 2_147_483_647;

/** Quantidade de itens/gold: inteiro positivo, sem NaN, frações ou Infinity. */
export const isValidQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Um saldo persistível em character.gold ou character.bankGold. */
export const isValidGoldBalance = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_GOLD;

/** Evita overflow e impede que se altere um saldo já inválido. */
export const canCreditGold = (balance: number, amount: number): boolean =>
  isValidGoldBalance(balance) &&
  Number.isSafeInteger(amount) &&
  amount >= 0 &&
  amount <= MAX_GOLD - balance;

/** Os identificadores não podem ser vazios ou objetos recebidos por JSON. */
export const isValidItemId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
