/**
 * deathSystem.ts
 *
 * Gerencia a morte de entidades (jogadores e monstros).
 *
 * - Jogador: perde 10% do XP (penalidade), emite evento, respawn na posição (0,0) com HP cheio.
 * - Monstro: concede XP ao killer, gera loot, cria um corpo (Corpse) no lugar, emite eventos de morte,
 *   agenda respawn automático (usando os dados de spawn armazenados) e notifica os clientes.
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
    // 🔥 ENVIA PLAYER STATS ATUALIZADOS PARA O CLIENTE
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
          xp: player.xp, // se quiser enviar XP também, adicione
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
    // 1. Concede XP se o assassino for um jogador
    if (killer instanceof Player) {
      const monsterLevel = (monster.type as any).level || 1;
      const baseXp = monster.type.combat.xp;
      const xpGained = ExperienceSystem.calculateMonsterXp(monsterLevel, killer.level, baseXp);
      ExperienceSystem.addXp(killer, xpGained);
      Logger.skill(`${killer.name} ganhou ${xpGained} XP por matar ${monster.name}.`);

      // 🔥 ENVIA PLAYER STATS PARA O JOGADOR QUE MATOU (XP ATUALIZADO)
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

    // 2. Gera loot
    const loot = LootSystem.generateLoot(monster);
    if (loot.length > 0) {
      Logger.loot(
        `🎁 ${monster.name} dropou: ${loot.map((i) => `${i.amount}x ${i.itemId}`).join(", ")}`,
      );
    }

    // 3. Cria corpo
    const corpseId = generateId();
    const corpse = new Corpse(corpseId, monster.position.x, monster.position.y, loot, killer?.id);
    world.addCorpse(corpse);

    const ws = WebSocketServer.getInstance();
    if (ws) ws.broadcastSpawnCorpse(corpse);

    // 4. Eventos
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

    monster.hp = 0;

    // 5. Respawn
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
}
