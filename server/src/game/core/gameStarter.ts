/**
 * gameStarter.ts
 * Responsável por inicializar o mundo, carregar NPCs, configurar autosave, input e loops do jogo.
 */

import { AsciiRenderer } from "../rendering/asciiRenderer";
import { initializeGame } from "../loaders/gameInitializer";
import { loadNpcs } from "../loaders/npcLoader";
import { startAutoSave } from "./autoSave";
import { setupInput } from "./inputHandler";
import { setupGracefulShutdown } from "./shutdownHandler";
import { startGameLoops } from "./gameLoop";
import { Logger } from "./logger/logger";

/**
 * Inicia o jogo propriamente dito.
 * @param characterName Nome do personagem a ser carregado (vindo da API ou fixo para testes)
 */
export async function startGame(characterName: string): Promise<void> {
  // Inicializa o mundo e o jogador (persistência em JSON)
  const { world, player } = await initializeGame(characterName);
  loadNpcs(world);

  const renderer = new AsciiRenderer();

  startAutoSave(player);
  setupInput(player, world);
  setupGracefulShutdown(player);
  startGameLoops(world, renderer);

  Logger.system(`Jogo iniciado com o personagem: ${characterName}`);
}
