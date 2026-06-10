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
 * - Transmitir a posição atualizada dos monstros a todos os clientes conectados.
 * - Iniciar tarefas agendadas (autosave, inatividade de guildas).
 *
 * @module game/core/gameStarter
 */

import { setupGracefulShutdown } from "./shutdownHandler";
import { startScheduledTasks } from "./scheduledTasks";
import { Logger } from "./logger/logger";
import { World } from "../world/World";
import { Player } from "../entities/player";
import { WebSocketServer } from "../../network/websocket/wsServer";

/**
 * Inicia os loops do servidor do jogo (IA, autosave, guildas) a partir de um mundo e jogador já existentes.
 * Esta função NÃO cria o mundo – ele deve ser criado antes (ex: via createWorldAndPlayer).
 *
 * @param world - Instância do mundo já carregado (com mapa, entidades, etc.)
 * @param player - Jogador já carregado (ou criado) e associado ao mundo
 * @param wsServer - Instância do servidor WebSocket para broadcast de movimentos
 * @returns {void}
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Configura o graceful shutdown (salva o jogador ao receber SIGINT).
 * 2. Inicia o loop periódico de IA (monstros, NPCs, condições).
 * 3. A cada atualização de monstro, verifica se a posição mudou e envia `broadcastMove`.
 * 4. Inicia tarefas agendadas (autosave a cada 60s, processamento de guildas a cada 24h).
 *
 * @example
 * ```typescript
 * // No main.ts, após criar o mundo e o jogador:
 * startGameLoops(world, player, wsServer);
 * ```
 */
export function startGameLoops(world: World, player: Player, wsServer: WebSocketServer): void {
  // 1. Configura o salvamento ao encerrar (Ctrl+C) – salva o jogador atual
  setupGracefulShutdown(player);

  // 2. Inicia apenas o loop de IA (monstros, NPCs, condições) – sem renderização
  startAiOnlyLoop(world, wsServer);

  // 3. Inicia tarefas periódicas (autosave, guildas, etc.)
  startScheduledTasks(player);

  Logger.system("Loops do jogo iniciados (IA, autosave, guildas, broadcast de movimento).");
}

/**
 * Inicia APENAS o loop de IA (monstros, NPCs, condições).
 * Não aciona renderização ASCII nem entrada de teclado.
 * Transmite mudanças de posição dos monstros para todos os clientes conectados.
 *
 * @param world - Mundo do jogo (contém entidades, tiles, etc.)
 * @param wsServer - Servidor WebSocket usado para broadcast de movimento
 * @returns {void}
 *
 * @remarks
 * O loop executa a cada 1.5 segundos e é responsável por:
 * - Atualizar a IA dos monstros (aggro, chase, wander, etc.)
 * - Atualizar condições dos monstros (poison, fire, etc.)
 * - Se a posição do monstro mudar, notifica todos os clientes via WebSocket
 * - Atualizar a IA dos NPCs (se tiver movimento)
 * - Atualizar condições dos jogadores
 * - Limpar monstros mortos do mundo
 */
function startAiOnlyLoop(world: World, wsServer: WebSocketServer): void {
  setInterval(() => {
    // Atualiza IA e condições dos monstros e transmite movimento
    world.monsters.forEach((monster) => {
      // Guarda posição anterior para detectar mudança
      const oldX = monster.position.x;
      const oldY = monster.position.y;

      // Executa a IA (pode alterar a posição)
      monster.ai.update(monster, world);
      monster.conditionManager.update();

      // Se a posição mudou, notifica todos os clientes conectados
      if (oldX !== monster.position.x || oldY !== monster.position.y) {
        wsServer.broadcastMove(monster.id, monster.position.x, monster.position.y);
      }
    });

    // Atualiza IA dos NPCs (ex: Guide que anda em círculo)
    world.npcs.forEach((npc) => {
      if (npc.ai) {
        const oldX = npc.position.x;
        const oldY = npc.position.y;
        npc.ai.update(npc, world);
        if (oldX !== npc.position.x || oldY !== npc.position.y) {
          wsServer.broadcastMove(npc.id, npc.position.x, npc.position.y);
        }
      }
    });

    // Atualiza condições dos jogadores (ex: poison, burn)
    world.players.forEach((player) => player.conditionManager.update());

    // Remove monstros com HP <= 0 (mortos)
    world.cleanupDeadMonsters();
  }, 1500);
}
