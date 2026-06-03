/**
 * gameStarter.ts
 *
 * Orquestra toda a inicialização do jogo:
 * - Cria mundo e jogador (via worldFactory)
 * - Carrega NPCs (via npcLoader)
 * - Configura input, graceful shutdown, game loops
 * - Inicia tarefas agendadas (autosave, inatividade de guildas)
 *
 * @module game/core/gameStarter
 */

import { AsciiRenderer } from "../rendering/asciiRenderer";
import { loadNpcs } from "../loaders/npcLoader";
import { setupInput } from "./inputHandler";
import { setupGracefulShutdown } from "./shutdownHandler";
import { startGameLoops } from "./gameLoop";
import { startScheduledTasks } from "./scheduledTasks";
import { Logger } from "./logger/logger";
import { createWorldAndPlayer } from "../initialization/worldFactory";

/**
 * Inicia o jogo propriamente dito.
 *
 * @param characterName - Nome do personagem a ser carregado (vindo da API ou fixo para testes)
 * @returns {Promise<void>}
 *
 * @remarks
 * Este é o orquestrador principal chamado pelo `main.ts`. Ele:
 * 1. Cria o mundo e o jogador (persistência em JSON)
 * 2. Carrega todos os NPCs estáticos
 * 3. Configura o renderizador ASCII
 * 4. Liga o sistema de entrada (teclado) e graceful shutdown
 * 5. Inicia os loops do jogo (IA e renderização)
 * 6. Inicia as tarefas periódicas (autosave, inatividade de guildas)
 *
 * @example
 * ```typescript
 * // No main.ts
 * startGame("Richard");
 * ```
 */
export async function startGame(characterName: string): Promise<void> {
  // 1. Cria o mundo e o jogador (substitui o antigo initializeGame)
  const { world, player } = await createWorldAndPlayer(characterName);

  // 2. Carrega todos os NPCs
  loadNpcs(world);

  // 3. Renderizador ASCII
  const renderer = new AsciiRenderer();

  // 4. Configurações de input e shutdown
  setupInput(player, world);
  setupGracefulShutdown(player);

  // 5. Inicia loops do jogo (IA e renderização)
  startGameLoops(world, renderer);

  // 6. Inicia tarefas periódicas
  startScheduledTasks(player);

  Logger.system(`Jogo iniciado com o personagem: ${characterName}`);
}
