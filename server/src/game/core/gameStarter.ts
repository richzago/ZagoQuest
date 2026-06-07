/**
 * gameStarter.ts
 *
 * Orquestra a inicialização do jogo na versão **headless** (sem terminal/ASCII).
 * Utiliza apenas o mapa Tiled, loaders modernos e não depende de renderização ou entrada via teclado.
 *
 * Responsabilidades:
 * - Criar o mundo e o jogador via `worldFactory` (que carrega o mapa Tiled).
 * - Configurar o graceful shutdown (salvar ao encerrar).
 * - Iniciar o loop de IA (monstros, NPCs, condições) sem renderização.
 * - Iniciar tarefas agendadas (autosave, inatividade de guildas).
 *
 * @module game/core/gameStarter
 */

import { setupGracefulShutdown } from "./shutdownHandler";
import { startScheduledTasks } from "./scheduledTasks";
import { Logger } from "./logger/logger";
import { createWorldAndPlayer } from "../initialization/worldFactory";
import { World } from "../world/World";

/**
 * Inicia o servidor do jogo (modo headless, pronto para conexões WebSocket).
 *
 * @param characterName - Nome do personagem a ser carregado (usado durante testes, futuramente virá da sessão autenticada)
 * @returns {Promise<void>}
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Cria o mundo e o jogador via `createWorldAndPlayer()` (carrega mapa Tiled, spawna monstros/NPCs, configura banco).
 * 2. Registra o graceful shutdown (salva o jogador ao receber SIGINT).
 * 3. Inicia o loop periódico de IA (monstros, NPCs, condições).
 * 4. Inicia tarefas agendadas (autosave a cada 60s, processamento de guildas a cada 24h).
 *
 * **Nota:** Não há renderização ASCII nem entrada pelo teclado – o servidor aguarda comandos via WebSocket (cliente Unity).
 *
 * @example
 * ```typescript
 * // No main.ts
 * startGame("Richard");
 * ```
 */
export async function startGame(characterName: string): Promise<void> {
  // 1. Cria o mundo e o jogador (mapa Tiled, loaders)
  const { world, player } = await createWorldAndPlayer(characterName);

  // 2. Configura o salvamento ao encerrar (Ctrl+C)
  setupGracefulShutdown(player);

  // 3. Inicia apenas o loop de IA (monstros, NPCs, condições) – sem renderização
  startAiOnlyLoop(world);

  // 4. Inicia tarefas periódicas (autosave, guildas, etc.)
  startScheduledTasks(player);

  Logger.system(`Jogo iniciado com o personagem: ${characterName}`);
}

/**
 * Inicia APENAS o loop de IA (monstros, NPCs, condições).
 * Não aciona renderização ASCII nem entrada de teclado.
 *
 * @param world - Mundo do jogo (contém entidades, tiles, etc.)
 * @returns {void}
 *
 * @remarks
 * O loop executa a cada 1.5 segundos e é responsável por:
 * - Atualizar a IA dos monstros (aggro, chase, wander, etc.)
 * - Atualizar condições dos monstros (poison, fire, etc.)
 * - Atualizar a IA dos NPCs (se tiver movimento)
 * - Atualizar condições dos jogadores
 * - Limpar monstros mortos do mundo
 */
function startAiOnlyLoop(world: World): void {
  setInterval(() => {
    // Atualiza IA e condições dos monstros
    world.monsters.forEach((monster) => {
      monster.ai.update(monster, world);
      monster.conditionManager.update();
    });

    // Atualiza IA dos NPCs (ex: Guide que anda em círculo)
    world.npcs.forEach((npc) => npc.ai?.update(npc, world));

    // Atualiza condições dos jogadores (ex: poison, burn)
    world.players.forEach((player) => player.conditionManager.update());

    // Remove monstros com HP <= 0 (mortos)
    world.cleanupDeadMonsters();
  }, 1500);
}
