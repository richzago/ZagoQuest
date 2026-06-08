/**
 * gameStarter.ts
 *
 * Orquestra a inicialização dos loops do jogo (headless).
 * Não cria o mundo – ele deve ser criado externamente (por exemplo, no main.ts)
 * e passado para esta função.
 *
 * Responsabilidades:
 * - Configurar o graceful shutdown (salvar ao encerrar).
 * - Iniciar o loop de IA (monstros, NPCs, condições) sem renderização.
 * - Iniciar tarefas agendadas (autosave, inatividade de guildas).
 *
 * @module game/core/gameStarter
 */

import { setupGracefulShutdown } from "./shutdownHandler";
import { startScheduledTasks } from "./scheduledTasks";
import { Logger } from "./logger/logger";
import { World } from "../world/World";
import { Player } from "../entities/player";

/**
 * Inicia os loops do servidor do jogo (IA, autosave, guildas) a partir de um mundo e jogador já existentes.
 * Esta função NÃO cria o mundo – ele deve ser criado antes (ex: via createWorldAndPlayer).
 *
 * @param world - Instância do mundo já carregado (com mapa, entidades, etc.)
 * @param player - Jogador já carregado (ou criado) e associado ao mundo
 * @returns {void}
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Configura o graceful shutdown (salva o jogador ao receber SIGINT).
 * 2. Inicia o loop periódico de IA (monstros, NPCs, condições).
 * 3. Inicia tarefas agendadas (autosave a cada 60s, processamento de guildas a cada 24h).
 *
 * @example
 * ```typescript
 * // No main.ts, após criar o mundo e o jogador:
 * startGameLoops(world, player);
 * ```
 */
export function startGameLoops(world: World, player: Player): void {
  // 1. Configura o salvamento ao encerrar (Ctrl+C) – salva o jogador atual
  setupGracefulShutdown(player);

  // 2. Inicia apenas o loop de IA (monstros, NPCs, condições) – sem renderização
  startAiOnlyLoop(world);

  // 3. Inicia tarefas periódicas (autosave, guildas, etc.)
  startScheduledTasks(player);

  Logger.system("Loops do jogo iniciados (IA, autosave, guildas).");
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
