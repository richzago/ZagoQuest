/**
 * Define o tipo de log (domínio do sistema).
 * Isso permite separar arquivos depois.
 */
export enum LogChannel {
  SYSTEM = "system",
  COMBAT = "combat",
  AI = "ai",
  WORLD = "world",
  ECONOMY = "economy",
  SKILL = "skill",
  LOOT = "loot",
}
