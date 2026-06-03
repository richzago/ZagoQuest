/**
 * shutdownHandler.ts
 *
 * Captura sinais de interrupção (Ctrl+C) para salvar antes de sair.
 *
 * @module game/core/shutdownHandler
 */

import { Player } from "../entities/player";
import { DatabasePersistence } from "../systems/databasePersistence";
import { Logger } from "./logger/logger";

/**
 * Configura o handler para finalização graciosa (graceful shutdown) do servidor.
 *
 * @param player - Jogador atual (para salvar seus dados)
 * @returns {void}
 *
 * @remarks
 * Quando o usuário pressiona Ctrl+C (SIGINT), esta função salva o estado do jogador
 * antes de encerrar o processo.
 *
 * @example
 * ```typescript
 * // No gameStarter.ts
 * setupGracefulShutdown(player);
 * ```
 */
export function setupGracefulShutdown(player: Player): void {
  process.on("SIGINT", async () => {
    Logger.system("Sinal SIGINT recebido. Salvando antes de sair...");
    await DatabasePersistence.saveCharacter(player);
    process.exit(0);
  });
}
