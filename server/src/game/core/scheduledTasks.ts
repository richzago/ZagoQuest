/**
 * scheduledTasks.ts
 *
 * Centraliza todas as tarefas periódicas (setInterval) do servidor.
 * Inclui:
 * - Autosave do jogador (salvamento automático a cada 60 segundos)
 * - Processamento de inatividade de guildas (a cada 24 horas)
 * - (futuramente) outras tarefas como limpeza de logs, rankings, etc.
 *
 * @module game/core/scheduledTasks
 */

import { Player } from "../entities/player";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { GuildSystem } from "../systems/guildSystem";
import { Logger } from "./logger/logger";

/**
 * Inicia todas as tarefas agendadas.
 *
 * @param player - Referência ao jogador atual (necessário para autosave)
 * @returns {void}
 *
 * @remarks
 * Esta função deve ser chamada uma vez durante a inicialização do jogo.
 * Cada tarefa é executada em seu próprio intervalo.
 *
 * @example
 * ```typescript
 * // No gameStarter.ts
 * startScheduledTasks(player);
 * ```
 */
export function startScheduledTasks(player: Player): void {
  // ------------------------------------------------------------
  // 1. Autosave a cada 60 segundos (salva o progresso do jogador)
  // ------------------------------------------------------------
  setInterval(() => {
    PersistenceSystem.savePlayerSync(player);
    Logger.system(`[AUTOSAVE] Jogador ${player.name} salvo.`);
  }, 60000);

  // ------------------------------------------------------------
  // 2. Processar inatividade de guildas a cada 24 horas
  // ------------------------------------------------------------
  setInterval(
    () => {
      Logger.system("[SCHEDULED] Processando inatividade de guildas...");
      GuildSystem.processInactivity();
    },
    24 * 60 * 60 * 1000,
  );

  // ------------------------------------------------------------
  // (futuro) Adicione aqui outras tarefas periódicas
  // ------------------------------------------------------------
}
