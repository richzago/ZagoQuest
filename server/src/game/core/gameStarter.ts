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
 * - Processar ataque automático dos jogadores contra seus alvos.
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
import { CombatSystem } from "../combat/combatSystem";

/**
 * Inicia os loops do servidor do jogo (IA, autosave, guildas) a partir de um mundo e jogador já existentes.
 * Esta função NÃO cria o mundo – ele deve ser criado antes (ex: via createWorldAndPlayer).
 *
 * @param world - Instância do mundo já carregado (com mapa, entidades, etc.)
 * @param player - Jogador já carregado (ou criado) e associado ao mundo
 * @param wsServer - Instância do servidor WebSocket para broadcast de movimentos e notificações
 * @returns {void}
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Configura o graceful shutdown (salva o jogador ao receber SIGINT).
 * 2. Inicia o loop periódico de IA (monstros, NPCs, condições) + auto attack.
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

  // 2. Inicia o loop de IA + auto attack
  startAiAndAutoAttackLoop(world, wsServer);

  // 3. Inicia tarefas periódicas (autosave, guildas, etc.)
  startScheduledTasks(player);

  Logger.system(
    "Loops do jogo iniciados (IA, auto attack, autosave, guildas, broadcast de movimento).",
  );
}

/**
 * Inicia o loop que processa:
 * - IA dos monstros (movimento, aggro, chase, wander)
 * - IA dos NPCs (movimento)
 * - Condições (poison, burn, etc.) em monstros e jogadores
 * - Ataque automático dos jogadores contra seus alvos atuais
 *
 * O loop executa a cada 1.5 segundos.
 *
 * @param world - Mundo do jogo
 * @param wsServer - Servidor WebSocket para broadcast de movimento e notificações de auto attack
 */
function startAiAndAutoAttackLoop(world: World, wsServer: WebSocketServer): void {
  setInterval(() => {
    // ====================
    // 1. MOVIMENTO E IA DOS MONSTROS
    // ====================
    world.monsters.forEach((monster) => {
      const oldX = monster.position.x;
      const oldY = monster.position.y;

      monster.ai.update(monster, world);
      monster.conditionManager.update();

      // Se a posição mudou, notifica todos os clientes
      if (oldX !== monster.position.x || oldY !== monster.position.y) {
        wsServer.broadcastMove(monster.id, monster.position.x, monster.position.y);
      }
    });

    // ====================
    // 2. MOVIMENTO DOS NPCS (SE TIVEREM IA)
    // ====================
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

    // ====================
    // 3. CONDIÇÕES DOS JOGADORES (ex: poison, burn)
    // ====================
    world.players.forEach((player) => player.conditionManager.update());

    // ====================
    // 4. ATAQUE AUTOMÁTICO DOS JOGADORES
    // ====================
    for (const player of world.players) {
      if (!player.currentTargetId) continue; // sem alvo ativo

      const target = world.monsters.find((m) => m.id === player.currentTargetId);
      // Verifica se o alvo ainda existe e está vivo
      if (!target || target.hp <= 0) {
        // Para o ataque automático e notifica o cliente
        player.currentTargetId = undefined;
        wsServer.sendToPlayer(
          player.id,
          JSON.stringify({
            type: "autoAttackStopped",
            reason: "Alvo morto ou sumiu.",
          }),
        );
        continue;
      }

      // Verifica distância Manhattan (corpo a corpo: 1 tile)
      const dx = Math.abs(target.position.x - player.position.x);
      const dy = Math.abs(target.position.y - player.position.y);
      if (dx + dy <= 1) {
        // Ataque automático (respeita cooldown dentro do CombatSystem)
        CombatSystem.attack(player, target, world);
        // Se o monstro morreu durante o ataque, notifica o cliente
        if (target.hp <= 0) {
          player.currentTargetId = undefined;
          wsServer.sendToPlayer(
            player.id,
            JSON.stringify({
              type: "autoAttackStopped",
              reason: "Alvo morto.",
            }),
          );
        }
      }
      // Caso contrário (fora de alcance), o cliente pode lidar com auto follow
      // (opcional: o servidor pode enviar uma mensagem de "fora de alcance")
    }

    // ====================
    // 5. LIMPEZA DE MONSTROS MORTOS
    // ====================
    world.cleanupDeadMonsters();
  }, 1500); // 1.5 segundos
}
