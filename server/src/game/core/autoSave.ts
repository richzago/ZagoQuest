/**
 * autoSave.ts
 * Inicia um intervalo de salvamento periódico do jogador.
 */

import { Player } from "../entities/player";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { Logger } from "./logger/logger";

export function startAutoSave(player: Player, intervalMs: number = 60000): void {
  setInterval(() => {
    PersistenceSystem.savePlayerSync(player);
    Logger.system(`[AUTOSAVE] Jogador ${player.name} salvo.`);
  }, intervalMs);
}
