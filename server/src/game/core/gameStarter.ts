/**
 * gameStarter.ts
 *
 * Loop robusto com setInterval e logs detalhados.
 * Agora também remove monstros que estejam fora dos limites do mapa.
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
import { Monster } from "../entities/monster";

export function startGameLoops(world: World, player: Player, wsServer: WebSocketServer): void {
  setupGracefulShutdown(player);
  startAutoAttackLoop(world, wsServer);
  startScheduledTasks(player);
  Logger.system("Loops do jogo iniciados (IA, auto attack, autosave, guildas).");
}

function startAutoAttackLoop(world: World, wsServer: WebSocketServer): void {
  setInterval(() => {
    try {
      // 1. Movimento e IA dos monstros
      for (const monster of world.monsters) {
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

      // 4. Ataque automático
      for (const player of world.players) {
        if (!player.currentTargetId) continue;

        const target = world.monsters.find((m) => m.id === player.currentTargetId);
        if (!target || target.hp <= 0) {
          player.currentTargetId = undefined;
          wsServer.sendToPlayer?.(
            player.id,
            JSON.stringify({
              type: "autoAttackStopped",
              reason: "Alvo morto ou sumiu.",
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

        if (distance <= 1) {
          try {
            // CombatSystem.attack(player, target, world);
            const damageDealt = CombatSystem.attack(player, target, world);
            wsServer.broadcastDamage(target.id, target.hp, target.maxHp, damageDealt);
            if (target.hp <= 0) {
              player.currentTargetId = undefined;
              wsServer.sendToPlayer?.(
                player.id,
                JSON.stringify({
                  type: "autoAttackStopped",
                  reason: "Alvo morto",
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
  }, 1500); // 1.5 segundos
}
