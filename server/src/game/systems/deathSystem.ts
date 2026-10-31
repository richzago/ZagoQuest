/**
 * deathSystem.ts
 *
 * Gerencia a morte de entidades (jogadores e monstros).
 *
 * - Jogador: perde 10% do XP (penalidade), emite evento, respawn na posição (0,0) com HP cheio.
 * - Monstro: concede XP ao killer, gera loot, cria um corpo (Corpse) no lugar, emite eventos de morte,
 *   agenda respawn automático e notifica os clientes.
 *
 * O sistema usa o EventSystem para notificar outros sistemas (ex: quests, conquistas).
 *
 * @module game/systems/DeathSystem
 */

import { Logger } from "../core/logger/logger";
import { Player } from "../entities/player";
import { Monster } from "../entities/monster";
import { World } from "../world/World";
import { ExperienceSystem } from "./experienceSystem";
import { FishingSystem } from "./fishingSystem";
import { PlayerStatsSender } from "../../network/senders/playerStatsSender";
import { LootSystem } from "./lootSystem";
import { Corpse } from "../entities/corpse";
import { EventSystem } from "../core/events/eventSystem";
import {
  CombatKillEventData,
  MonsterDeathEventData,
  PlayerDeathEventData,
} from "../../shared/interfaces/eventData.interface";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { Damageable } from "../../shared/interfaces/damageable.interface";
import { WebSocketServer } from "../../network/websocket/wsServer";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { MonsterAI } from "../ai/monsterAi";
import { generateId } from "../../shared/utils/idUtils";

/**
 * Tempo de vida padrão de um corpo (em milissegundos) antes de ser removido.
 * Pode ser sobrescrito por variável de ambiente ou configurado globalmente.
 */
const DEFAULT_CORPSE_LIFETIME = 15000; // 15 segundos

export class DeathSystem {
  /** Respawns and corpse expirations belong to their World, not to the process. */
  private static pendingTimers = new WeakMap<World, Set<ReturnType<typeof setTimeout>>>();

  private static scheduleWorldTimeout(world: World, action: () => void, delay: number): void {
    let timers = this.pendingTimers.get(world);
    if (!timers) {
      timers = new Set();
      this.pendingTimers.set(world, timers);
    }
    const group = timers;
    const timer = setTimeout(() => {
      group.delete(timer);
      action();
    }, delay);
    group.add(timer);
  }

  /** Shutdown must not respawn monsters or send despawns after closing WebSocket. */
  static cancelPendingTimers(world: World): void {
    const timers = this.pendingTimers.get(world);
    if (!timers) return;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    this.pendingTimers.delete(world);
  }

  static handleDeath(victim: Damageable, killer: Damageable | undefined, world: World): void {
    if (victim.hp > 0) return;

    if (victim instanceof Monster) {
      // Morte deve acontecer UMA vez por entidade, mesmo com vários ataques no tick.
      // Não processar um monstro que já foi removido deste mundo.
      if (victim.deathProcessed || !world.monsters.includes(victim)) return;
      victim.deathProcessed = true;
    }

    // Pending fishing actions cannot reward after death or respawn.
    if (victim instanceof Player) FishingSystem.cancelFishing(victim);
    if (victim instanceof Player || victim instanceof Monster) victim.conditionManager.clear();
    Logger.combat(`💀 ${victim.name} morreu.`);

    if (victim instanceof Player) {
      this.handlePlayerDeath(victim, killer);
    } else if (victim instanceof Monster) {
      this.handleMonsterDeath(victim, killer, world);
    }
  }

  private static handlePlayerDeath(player: Player, killer?: Damageable): void {
    // Evita reduzir o nível nesta fase; o histórico de XP não é alterado.
    const xpLoss = ExperienceSystem.applyDeathPenalty(player);
    Logger.skill(`${player.name} perdeu ${xpLoss} XP. XP acumulado: ${player.xp}`);

    const eventSystem = EventSystem.getInstance();
    eventSystem.emit<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, {
      playerId: player.id,
      playerName: player.name,
      killerId: killer?.id,
      killerName: killer?.name,
    });

    player.position = { x: 0, y: 0 };
    player.hp = player.maxHp;
    player.currentTargetId = undefined;
    Logger.system(`${player.name} renasceu em (0,0) com HP total.`);

    // Stats alone update HUD; the client also needs its authoritative position.
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.sendToPlayer(player.id, JSON.stringify(PlayerStatsSender.toPayload(player)));
      wsServer.sendToPlayer(player.id, JSON.stringify({
        type: "position", x: player.position.x, y: player.position.y,
      }));
      wsServer.sendToPlayer(player.id, JSON.stringify({
        type: "autoAttackStopped", reason: "Jogador morreu.",
      }));
    }
  }

  private static handleMonsterDeath(
    monster: Monster,
    killer: Damageable | undefined,
    world: World,
  ): void {
    // ==========================================================
    // 1. CONCEDE XP AO JOGADOR (SE FOR O CASO)
    // ==========================================================
    // Apenas jogadores efetivamente presentes no mundo concorrem ao XP.
    // Dano periódico entra no mesmo ledger; overkill jamais gera vantagem.
    const contributors = [...monster.damageByPlayer].filter(([id, amount]) =>
      amount > 0 && world.players.some((player) => player.id === id));
    if (contributors.length === 0 && killer instanceof Player &&
        world.players.includes(killer)) {
      // Compatibilidade com mortes disparadas diretamente pelo DeathSystem.
      contributors.push([killer.id, 1]);
    }
    const contributions = new Map(contributors);
    // Único pool de XP: calculado pela regra existente em função do nível do
    // maior causador de dano, evitando múltiplos pools no multiplayer.
    const leader = [...contributions].sort((a,b) =>
      b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const leadPlayer = leader && world.players.find((p) => p.id === leader[0]);
    if (leadPlayer) {
      const pool = ExperienceSystem.calculateMonsterXp(
        monster.type.level ?? 1, leadPlayer.level, monster.type.combat.xp);
      const shares = ExperienceSystem.splitXpByDamage(pool, contributions);
      for (const [playerId, share] of shares) {
        if (share <= 0) continue;
        const player = world.players.find((p) => p.id === playerId);
        if (!player) continue;
        ExperienceSystem.addXp(player, share);
        Logger.skill(`${player.name} recebeu ${share}/${pool} XP por ${monster.name} (${contributions.get(playerId)} dano).`);
      }
    }

    // O corpse ainda guarda o último golpe: direitos de loot serão tratados
    // como regra separada. A divisão de XP não transfere itens.


    // ==========================================================
    // 2. GERA O LOOT
    // ==========================================================
    const loot = LootSystem.generateLoot(monster);
    if (loot.length > 0) {
      Logger.loot(
        `🎁 ${monster.name} dropou: ${loot.map((i) => `${i.amount}x ${i.itemId}`).join(", ")}`,
      );
    }

    // ==========================================================
    // 3. CRIA O CORPO (CORPSE) E NOTIFICA OS CLIENTES
    // ==========================================================
    const corpseId = generateId();
    const corpse = new Corpse(corpseId, monster.position.x, monster.position.y, loot, killer?.id);
    world.addCorpse(corpse);

    const ws = WebSocketServer.getInstance();
    if (ws) {
      ws.broadcastSpawnCorpse(corpse);
      Logger.loot(`Corpse ${corpseId} spawnado em (${corpse.position.x}, ${corpse.position.y})`);
    }

    // ==========================================================
    // 4. AGENDA A REMOÇÃO DO CORPO APÓS O TEMPO DE VIDA
    // ==========================================================
    this.scheduleCorpseRemoval(corpse, world, ws, DEFAULT_CORPSE_LIFETIME);

    // ==========================================================
    // 5. EMITE EVENTOS DE MORTE
    // ==========================================================
    const eventSystem = EventSystem.getInstance();
    eventSystem.emit<MonsterDeathEventData>(GameEvent.MONSTER_DEATH, {
      world,
      monsterId: monster.id,
      monsterName: monster.name,
      killerId: killer?.id,
      killerName: killer?.name,
      position: { x: monster.position.x, y: monster.position.y },
    });
    if (killer instanceof Player) {
      eventSystem.emit<CombatKillEventData>(GameEvent.COMBAT_KILL, {
        killerId: killer.id,
        killerName: killer.name,
        victimId: monster.id,
        victimName: monster.name,
      });
    }

    // ==========================================================
    // 6. MARCA O MONSTRO COMO MORTO E NOTIFICA OS CLIENTES
    // ==========================================================
    monster.hp = 0;
    if (ws) {
      ws.broadcastDespawn(monster.id);
      Logger.combat(`[DESPAWN] Enviado despawn para ${monster.name} (${monster.id})`);
    }

    // ==========================================================
    // 7. UM RESPAWN PARA ESTA VIDA (já protegida em handleDeath)
    // ==========================================================
    this.scheduleWorldTimeout(world, () => {
      if (!world.isWithinBounds(monster.spawnX, monster.spawnY)) {
        Logger.warn(`[Respawn] Ponto fora do mapa: ${monster.name}.`);
        return;
      }

      // O ponto de spawn permanece estável mesmo que o monstro mude de ID.
      // Caso outra entidade já tenha ocupado o mesmo ponto, não duplica.
      if (monster.spawnPointId && world.monsters.some((alive) =>
        alive.hp > 0 && alive.spawnPointId === monster.spawnPointId
      )) return;

      const definition = MonsterRegistry.get(monster.type.id);
      if (!definition) {
        Logger.error(`[Respawn] Monstro desconhecido: ${monster.type.id}`);
        return;
      }

      const next = new Monster(
        generateId(),
        definition,
        monster.spawnX,
        monster.spawnY,
        new MonsterAI(),
        monster.wanderRadius,
        monster.respawnTime,
        monster.spawnPointId,
      );
      world.addMonster(next);
      Logger.world(`[Respawn] ${next.name} (${next.id}) em (${next.spawnX},${next.spawnY}).`);
      if (ws) ws.broadcastSpawn(next);
    }, monster.respawnTime);
  }

  /**
   * Agenda a remoção de um corpo após um determinado tempo de vida.
   *
   * @param corpse - O corpo a ser removido
   * @param ws - Instância do WebSocketServer (pode ser undefined)
   * @param lifetime - Tempo de vida em milissegundos
   *
   * @remarks
   * Esta função é responsável por:
   * - Remover o corpo da lista do mundo após o tempo especificado.
   * - Notificar todos os clientes sobre a remoção (via broadcastDespawn).
   * - Registrar logs adequados.
   *
   * É separada para facilitar a manutenção e permitir futuras extensões
   * (ex: diferentes tempos de vida por tipo de monstro, configuração externa, etc.).
   */
  private static scheduleCorpseRemoval(
    corpse: Corpse,
    world: World, // ← necessário para remover o corpo
    ws: WebSocketServer | undefined,
    lifetime: number,
  ): void {
    this.scheduleWorldTimeout(world, () => {
      // Corpo já saqueado não deve gerar um segundo broadcast de despawn.
      if (!world.corpses.includes(corpse)) return;
      world.removeCorpse(corpse);
      // Notifica os clientes (se o WebSocket existir)
      if (ws) {
        ws.broadcastDespawn(corpse.id);
        Logger.loot(`Corpse ${corpse.id} removido após ${lifetime / 1000} segundos.`);
      }
    }, lifetime);
  }
}
