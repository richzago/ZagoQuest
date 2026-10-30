/**
 * Finalização do servidor ao receber Ctrl+C (SIGINT) ou SIGTERM.
 * O timer de autosave é parado e qualquer save em andamento termina antes
 * do último salvamento, evitando escritas concorrentes do mesmo personagem.
 *
 * O encerramento completo de HTTP/WebSocket fica para a etapa de lifecycle.
 */
import type { Player } from "../entities/player";
import type { ScheduledTasksHandle } from "./scheduledTasks";
import { DatabasePersistence } from "../systems/databasePersistence";
import { Logger } from "./logger/logger";

/**
 * Instala listeners UMA vez por inicialização.
 * Devolve uma função de remoção, útil em testes e no futuro hot-reload.
 */
export function setupGracefulShutdown(
  player: Player,
  tasks?: ScheduledTasksHandle,
): () => void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return; // SIGINT + SIGTERM não podem duplicar o save final.
    shuttingDown = true;
    Logger.system(`[SHUTDOWN] ${signal} recebido; salvando ${player.name}...`);

    try {
      // O controller espera saves ativos e realiza UM último save.
      if (tasks) await tasks.flushAutosave();
      else await DatabasePersistence.saveCharacter(player);
      Logger.system("[SHUTDOWN] Personagem salvo com sucesso.");
      process.exit(0);
    } catch (error) {
      Logger.error(`[SHUTDOWN] Falha no salvamento: ${String(error)}`);
      process.exit(1); // Não anunciar encerramento bem-sucedido após erro.
    }
  };

  const onSigint = (): void => { void shutdown("SIGINT"); };
  const onSigterm = (): void => { void shutdown("SIGTERM"); };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  return () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };
}
