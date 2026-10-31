/**
 * gameStarter.ts
 *
 * Loop robusto com setInterval e logs detalhados.
 * Agora também remove monstros que estejam fora dos limites do mapa.
 *
 * @module game/core/gameStarter
 */

import {
  startScheduledTasks,
  type ScheduledTaskDependencies,
} from "./scheduledTasks";
import { Logger } from "./logger/logger";
import { World } from "../world/World";
import { Player } from "../entities/player";
import { WebSocketServer } from "../../network/websocket/wsServer";
import { PlayerAttackSystem } from "../combat/playerAttackSystem";
import { Monster } from "../entities/monster";
import { performance } from "node:perf_hooks";
import { TickMetrics } from "./tickMetrics";
import { FoodRegenerationSystem } from "../systems/foodRegenerationSystem";
import { PlayerStatsSender } from "../../network/senders/playerStatsSender";

/** Keep game tick duration separate from autosave/guild schedules. */
// AI decisions are frequent; creature-specific cooldown controls steps.
export const GAME_TICK_MS = 250;

type Timer = ReturnType<typeof setInterval>;

export interface GameLoopDependencies {
  scheduleWorldTick?: (callback: () => void, intervalMs: number) => Timer;
  cancelWorldTick?: (timer: Timer) => void;
  scheduledTasks?: ScheduledTaskDependencies;
}

export interface GameLoopsHandle {
  /** Immediately stops new world ticks and scheduled autosaves/guild jobs. */
  stop(): void;
  /** Waits for an in-flight autosave, then writes a final snapshot once. */
  flushAutosave(): Promise<void>;
  /** Waits for an in-progress guild maintenance job before closing PostgreSQL. */
  waitForTasks(): Promise<void>;
}

const activeWorlds = new WeakMap<World, GameLoopsHandle>();

/**
 * Start each world's loop only once. The main bootstrap owns signals/shutdown,
 * NOT this scheduler. stop() also disables queued callbacks from old timers.
 */
export function startGameLoops(
  world: World,
  player: Player | undefined, // sessão autenticada começa sem jogador legado
  wsServer: WebSocketServer,
  deps: GameLoopDependencies = {},
): GameLoopsHandle {
  const existing = activeWorlds.get(world);
  if (existing) {
    Logger.warn("[GAME] Mundo já possui loop ativo; reutilizando controller.");
    return existing;
  }

  // Consulta world.players a cada ciclo, mantendo as correções da Fase 3.
  const tasks = startScheduledTasks(() => world.players, deps.scheduledTasks);
  const schedule = deps.scheduleWorldTick ?? ((callback, ms) => setInterval(callback, ms));
  const cancel = deps.cancelWorldTick ?? ((timer) => clearInterval(timer));
  let stopped = false;
  let worldTimer: Timer;
  const metricsEnabled = process.env.GAME_METRICS_ENABLED === "true";
  const tickMetrics = metricsEnabled ? new TickMetrics(512, GAME_TICK_MS) : undefined;
  let cpuSinceReport = process.cpuUsage();
  let lastReportAt = performance.now();
  let measuredTicks = 0;

  try {
    worldTimer = schedule(() => {
      if (stopped) return;
      if (!tickMetrics) {
        tickWorld(world, wsServer);
        return;
      }
      const began = performance.now();
      try {
        tickWorld(world, wsServer);
      } finally {
        tickMetrics.record(performance.now() - began);
        // Stats are sampled, never emitted once per tick; benchmark is optional.
        if (++measuredTicks % 240 === 0) {
          const stats = tickMetrics.snapshot();
          const elapsedMs = Math.max(1, performance.now() - lastReportAt);
          const cpu = process.cpuUsage(cpuSinceReport);
          cpuSinceReport = process.cpuUsage();
          lastReportAt = performance.now();
          const memory = process.memoryUsage();
          const network = wsServer.getNetworkLoad?.();
          Logger.system(
            `[METRICS] ticks=${stats.totalTicks} n=${stats.samples}` +
            ` p50=${stats.p50Ms.toFixed(2)}ms p95=${stats.p95Ms.toFixed(2)}ms` +
            ` p99=${stats.p99Ms.toFixed(2)}ms slow=${stats.slowTicks}` +
            ` cpu1core=${((cpu.user + cpu.system) / (elapsedMs * 1000) * 100).toFixed(1)}%` +
            ` rss=${(memory.rss / 1048576).toFixed(1)}MiB` +
            ` players=${world.players.length} monsters=${world.monsters.length}` +
            ` sockets=${network?.connected ?? 0} pending=${network?.pendingCommands ?? 0}`,
          );
        }
      }
    }, GAME_TICK_MS);
  } catch (error) {
    tasks.stop();
    throw error;
  }

  const handle: GameLoopsHandle = {
    stop(): void {
      if (stopped) return;
      stopped = true;
      cancel(worldTimer);
      tasks.stop();
      if (activeWorlds.get(world) === handle) activeWorlds.delete(world);
    },
    flushAutosave: () => tasks.flushAutosave(),
    waitForTasks: () => tasks.waitForIdle(),
  };

  activeWorlds.set(world, handle);
  Logger.system("Loops do jogo iniciados (IA, auto attack, autosave, guildas).");
  return handle;
}

/**
 * Single synchronous game tick, extracted to make timer lifecycle explicit.
 * Exceptions are already caught per entity and around the whole tick.
 */
export function tickWorld(world: World, wsServer: WebSocketServer): void {
    try {
      // 1. Movimento e IA dos monstros
      for (const monster of world.monsters) {
        // DeathSystem marcará a morte antes do cleanup do próximo tick.
        if (monster.hp <= 0 || monster.deathProcessed) continue;
        try {
          const oldX = monster.position.x;
          const oldY = monster.position.y;
          monster.ai.update(monster, world);
          monster.conditionManager.update();
          if (oldX !== monster.position.x || oldY !== monster.position.y) {
            wsServer.broadcastMove(monster.id, monster.position.x, monster.position.y);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          Logger.error(`Erro no update do monstro ${monster.id}: ${msg}`);
        }
      }

      // 2. Movimento dos NPCs
      for (const npc of world.npcs) {
        if (npc.ai) {
          try {
            const oldX = npc.position.x;
            const oldY = npc.position.y;
            npc.ai.update(npc, world);
            if (oldX !== npc.position.x || oldY !== npc.position.y) {
              wsServer.broadcastMove(npc.id, npc.position.x, npc.position.y);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Logger.error(`Erro no update do NPC ${npc.id}: ${msg}`);
          }
        }
      }

      // 3. Condições dos jogadores
      for (const player of world.players) {
        try {
          player.conditionManager.update();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          Logger.error(`Erro nas condições do player ${player.id}: ${msg}`);
        }
      }

      // A alimentação não cria um setInterval por personagem. Este tick usa
      // timestamps do Node e transmite stats SOMENTE se HP/mana mudou.
      // O servidor decide limites; Canvas do Unity apenas apresenta.
      for (const player of world.players) {
        try {
          if (FoodRegenerationSystem.tick(player))
            wsServer.sendToPlayer?.(player.id, JSON.stringify(PlayerStatsSender.toPayload(player)));
        } catch (error) {
          Logger.error(`[FOOD] Falha no tick de ${player.id}: ${String(error)}`);
        }
      }

      // 4. Ataque automático
      for (const player of world.players) {
        if (!player.currentTargetId) continue;

        const target = world.monsters.find((m) => m.id === player.currentTargetId);
        if (!target || target.hp <= 0) {
          const stoppedTargetId = player.currentTargetId;
          player.currentTargetId = undefined;
          wsServer.sendToPlayer?.(
            player.id,
            JSON.stringify({
              type: "autoAttackStopped",
              reason: "Alvo morto ou sumiu.",
              targetId: stoppedTargetId,
            }),
          );
          Logger.combat(`[AUTO] ${player.name} perdeu alvo (morto/sumiu)`);
          continue;
        }

        const dx = Math.abs(target.position.x - player.position.x);
        const dy = Math.abs(target.position.y - player.position.y);
        const distance = dx + dy;

        // Log de distância a cada 5 segundos (útil para debug)
        if (Math.floor(Date.now() / 5000) > Math.floor((Date.now() - 1500) / 5000)) {
          Logger.combat(`[AUTO] ${player.name} distância de ${target.name}: ${distance}`);
        }

        // Ataque manual aceita adjacência diagonal (hipotenusa <= 1.5).
        // Usar a MESMA regra aqui evita o autoataque falhar só na diagonal.
        if (!PlayerAttackSystem.validateTarget(player, target, world)) {
          try {
            // Compartilha alcance/cooldown com ataque manual; o dano é
            // propagado UMA vez por CombatEventBridge (COMBAT_DAMAGE).
            const result = PlayerAttackSystem.tryAttack(player, target, world);
            if (result.ok && target.hp <= 0) {
              player.currentTargetId = undefined;
              wsServer.sendToPlayer?.(
                player.id,
                JSON.stringify({
                  type: "autoAttackStopped",
                  reason: "Alvo morto",
                  targetId: target.id,
                }),
              );
              Logger.combat(`[AUTO] ${player.name} matou ${target.name}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Logger.error(`Erro no ataque de ${player.name} contra ${target.name}: ${msg}`);
          }
        }
      }

      // 5. Limpeza de monstros mortos
      world.cleanupDeadMonsters();

      // 6. Limpeza de monstros fora dos limites do mundo
      const monstersOutOfBounds: Monster[] = [];
      for (const monster of world.monsters) {
        if (!world.isWithinBounds(monster.position.x, monster.position.y)) {
          monstersOutOfBounds.push(monster);
          Logger.warn(
            `Monstro ${monster.name} (${monster.id}) fora dos limites em (${monster.position.x}, ${monster.position.y}) - removendo.`,
          );
        }
      }
      for (const monster of monstersOutOfBounds) {
        world.removeMonster(monster);
        wsServer.broadcastDespawn(monster.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      Logger.error(`Erro crítico no loop principal: ${msg}`);
      if (stack) Logger.error(stack);
    }
}
