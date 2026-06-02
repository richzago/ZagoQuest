/**
 * logger.config.ts
 *
 * Configuração central do sistema de logs.
 * Controla:
 * - Modo debug (liga/desliga logs)
 * - Nível mínimo de severidade (DEBUG, INFO, WARN, ERROR)
 * - Escrita em arquivo
 * - Rotação diária de arquivos
 * - Quais canais estão ativos (filtro por domínio)
 */

import { LogChannel } from "../../../shared/enums/logChannel.enum";
import { LogLevel } from "../../../shared/enums/logLevel.enum";

export const LoggerConfig = {
  /**
   * Modo debug.
   * Se `true`, os logs são processados (exibidos e/ou salvos).
   * Se `false`, o sistema ignora completamente qualquer chamada de log (útil em produção).
   */
  debug: true,

  /**
   * Nível mínimo de severidade.
   * Apenas mensagens com nível igual ou superior a este serão registradas.
   * Ordem: DEBUG (0) < INFO (1) < WARN (2) < ERROR (3).
   * Exemplo: se level = LogLevel.INFO, mensagens DEBUG são ignoradas.
   */
  level: LogLevel.DEBUG,

  /**
   * Habilita a escrita dos logs em arquivos (dentro da pasta `logs/`).
   * Se `false`, os logs vão apenas para o console.
   */
  fileLogging: true,

  /**
   * Rotação de arquivos por dia.
   * Se `true`, os arquivos terão o formato `canal-YYYY-MM-DD.log` (ex: `combat-2025-01-01.log`).
   * Se `false`, todos os logs do mesmo canal vão para um único arquivo (`canal.log`).
   */
  rotation: true,

  /**
   * Lista de canais habilitados.
   * Mensagens enviadas para canais que não estão nesta lista são ignoradas.
   * Isso permite desligar temporariamente certos tipos de log (ex: desabilitar logs de IA durante testes).
   */
  enabledChannels: [
    LogChannel.SYSTEM, // Inicialização, desligamento, eventos gerais
    LogChannel.COMBAT, // Dano, morte, XP
    LogChannel.AI, // Comportamento de monstros (aggro, perseguição, fuga)
    LogChannel.WORLD, // Spawn de entidades, carregamento de mapa
    LogChannel.ECONOMY, // Transações (loja, banco, compra/venda)
    LogChannel.SKILL, // Progressão de habilidades (level up, ganho de skill)
    LogChannel.LOOT, // Coleta de itens de corpos, drops
  ],
};
