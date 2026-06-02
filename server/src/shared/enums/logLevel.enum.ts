/**
 * logLevel.enum.ts
 *
 * Níveis de severidade para mensagens de log.
 * Usados para filtrar mensagens com base na importância.
 *
 * @module shared/enums/LogLevel
 */

export enum LogLevel {
  /** Informação de depuração (mais detalhada, geralmente desligada em produção) */
  DEBUG = "DEBUG",

  /** Informação geral (operações normais) */
  INFO = "INFO",

  /** Aviso (algo inesperado, mas não crítico) */
  WARN = "WARN",

  /** Erro (falha em alguma operação, mas o sistema continua) */
  ERROR = "ERROR",
}
