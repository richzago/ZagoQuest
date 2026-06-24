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
  static handleDeath(victim: Damageable, killer: Damageable | undefined, world: World): void {
    if (victim.hp > 0) return;

    Logger.combat(`💀 ${victim.name} morreu.`);

    if (victim instanceof Player) {
      this.handlePlayerDeath(victim, killer);
    } else if (victim instanceof Monster) {
      this.handleMonsterDeath(victim, killer, world);
    }
  }

  private static handlePlayerDeath(player: Player, killer?: Damageable): void {
    const xpLoss = Math.max(1, Math.floor(player.xp * 0.1));
    player.xp = Math.max(0, player.xp - xpLoss);
    Logger.skill(`${player.name} perdeu ${xpLoss} XP. XP restante: ${player.xp}`);

    const eventSystem = EventSystem.getInstance();
    eventSystem.emit<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, {
      playerId: player.id,
      playerName: player.name,
      killerId: killer?.id,
      killerName: killer?.name,
    });

    player.position = { x: 0, y: 0 };
    player.hp = player.maxHp;
    Logger.system(`${player.name} renasceu em (0,0) com HP total.`);

    // ==========================================================
    // ENVIA PLAYER STATS ATUALIZADOS PARA O CLIENTE
    // ==========================================================
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.sendToPlayer(
        player.id,
        JSON.stringify({
          type: "playerStats",
          hp: player.hp,
          maxHp: player.maxHp,
          mana: player.mana,
          maxMana: player.maxMana,
          level: player.level,
          attack: player.attack,
          defense: player.defense,
          xp: player.xp,
        }),
      );
      Logger.combat(`[HUD] PlayerStats enviado para ${player.name} (respawn)`);
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
    if (killer instanceof Player) {
      const monsterLevel = (monster.type as any).level || 1;
      const baseXp = monster.type.combat.xp;
      const xpGained = ExperienceSystem.calculateMonsterXp(monsterLevel, killer.level, baseXp);
      ExperienceSystem.addXp(killer, xpGained);
      Logger.skill(`${killer.name} ganhou ${xpGained} XP por matar ${monster.name}.`);

      // Atualiza o HUD do jogador com o novo XP
      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        wsServer.sendToPlayer(
          killer.id,
          JSON.stringify({
            type: "playerStats",
            hp: killer.hp,
            maxHp: killer.maxHp,
            mana: killer.mana,
            maxMana: killer.maxMana,
            level: killer.level,
            attack: killer.attack,
            defense: killer.defense,
            xp: killer.xp,
          }),
        );
        Logger.combat(`[HUD] PlayerStats enviado para ${killer.name} (ganhou XP)`);
      }
    }

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
    // 7. RESPAWN AUTOMÁTICO DO MONSTRO
    // ==========================================================
    const respawnTime = monster.respawnTime;
    setTimeout(() => {
      const monsterDef = MonsterRegistry.get(monster.type.id);
      if (monsterDef) {
        const newId = generateId();
        const newMonster = new Monster(
          newId,
          monsterDef,
          monster.spawnX,
          monster.spawnY,
          new MonsterAI(),
          monster.wanderRadius,
          monster.respawnTime,
        );
        world.addMonster(newMonster);
        Logger.world(
          `Monstro ${newMonster.name} respawnado em (${monster.spawnX}, ${monster.spawnY}) com ID ${newId}`,
        );
        if (ws) ws.broadcastSpawn(newMonster);
      } else {
        Logger.error(`[Respawn] Definição do monstro ${monster.name} não encontrada.`);
      }
    }, respawnTime);
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
    setTimeout(() => {
      // Remove o corpo do mundo (método de instância)
      world.removeCorpse(corpse);
      // Notifica os clientes (se o WebSocket existir)
      if (ws) {
        ws.broadcastDespawn(corpse.id);
        Logger.loot(`Corpse ${corpse.id} removido após ${lifetime / 1000} segundos.`);
      }
    }, lifetime);
  }
}
