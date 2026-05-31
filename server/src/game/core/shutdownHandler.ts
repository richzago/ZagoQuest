/**
 * shutdownHandler.ts
 * Captura sinais de interrupção (Ctrl+C) para salvar antes de sair.
 */

import { Player } from "../entities/player";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { Logger } from "./logger/logger";

export function setupGracefulShutdown(player: Player): void {
  process.on("SIGINT", () => {
    Logger.system("Sinal SIGINT recebido. Salvando antes de sair...");
    PersistenceSystem.savePlayerSync(player);
    process.exit(0);
  });
}
