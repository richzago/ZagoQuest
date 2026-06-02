/**
 * logChannel.enum.ts
 *
 * Canais de log disponíveis no sistema de logging.
 * Cada canal corresponde a um domínio específico do jogo,
 * permitindo filtrar ou rotear mensagens para arquivos separados.
 *
 * @module shared/enums/LogChannel
 */

export enum LogChannel {
  /** Mensagens de sistema (inicialização, desligamento, eventos gerais) */
  SYSTEM = "system",

  /** Mensagens de combate (dano, morte, XP) */
  COMBAT = "combat",

  /** Mensagens de inteligência artificial (aggro, perseguição, fuga) */
  AI = "ai",

  /** Mensagens do mundo (spawn de entidades, carregamento de mapa) */
  WORLD = "world",

  /** Mensagens de economia (transações, loja, banco) */
  ECONOMY = "economy",

  /** Mensagens de habilidades (progresso, level up) */
  SKILL = "skill",

  /** Mensagens de coleta de loot (itens, corpos) */
  LOOT = "loot",
}
