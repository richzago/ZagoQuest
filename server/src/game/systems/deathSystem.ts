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

/**
 * Classe estática que orquestra as consequências da morte de uma entidade.
 *
 * @remarks
 * - Para jogadores: aplica penalidade de 10% de XP, emite evento e respawna na posição (0,0) com HP cheio.
 * - Para monstros: concede XP ao assassino (se for jogador), gera loot, cria um corpo (Corpse),
 *   emite eventos de morte, agenda respawn e notifica os clientes via WebSocket.
 *
 * O sistema depende do `ExperienceSystem` para cálculo de XP, do `LootSystem` para geração de itens,
 * e do `EventSystem` para notificar outros módulos (ex: quests, conquistas).
 *
 * @example
 * ```typescript
 * // Chamado pelo CombatSystem após aplicar dano fatal
 * DeathSystem.handleDeath(target, attacker, world);
 * ```
 */
export class DeathSystem {
  /**
   * Ponto de entrada para qualquer morte.
   * Verifica o tipo da vítima e chama o handler apropriado.
   *
   * @param victim - Quem morreu (deve ser `Player` ou `Monster`)
   * @param killer - Quem causou a morte (opcional, pode ser `Player`, `Monster` ou `undefined`)
   * @param world - Mundo (necessário para criar corpo e remover entidade)
   * @returns {void}
   *
   * @remarks
   * A função é chamada automaticamente pelo `CombatSystem` quando o HP do alvo chega a 0.
   * Não faz nada se o HP da vítima for maior que 0 (proteção contra chamadas indevidas).
   *
   * @example
   * ```typescript
   * // No CombatSystem.attack()
   * if (target.hp <= 0) {
   *   DeathSystem.handleDeath(target, attacker, world);
   * }
   * ```
   */
  static handleDeath(victim: Damageable, killer: Damageable | undefined, world: World): void {
    if (victim.hp > 0) return;

    Logger.combat(`💀 ${victim.name} morreu.`);

    if (victim instanceof Player) {
      this.handlePlayerDeath(victim, killer);
    } else if (victim instanceof Monster) {
      this.handleMonsterDeath(victim, killer, world);
    }
  }

  /**
   * Processa a morte de um jogador.
   * - Aplica penalidade de XP (10% do atual, mínimo 1)
   * - Emite evento `PLAYER_DEATH`
   * - Respawn na posição (0,0) com HP total
   *
   * @param player - Jogador morto
   * @param killer - Quem matou (opcional, pode ser `Player`, `Monster` ou `undefined`)
   * @returns {void}
   *
   * @remarks
   * A penalidade é sempre pelo menos 1 XP. Após a morte, o jogador reaparece na origem do mapa (0,0).
   * O evento `PLAYER_DEATH` pode ser usado por outros sistemas (ex: registrar mortes em estatísticas, aplicar conquistas).
   *
   * @example
   * ```typescript
   * // Internamente chamado por handleDeath
   * private static handlePlayerDeath(player, killer) { ... }
   * ```
   */
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
  }

  /**
   * Processa a morte de um monstro.
   * - Concede XP ao killer (se for jogador)
   * - Gera o loot (via `LootSystem.generateLoot`)
   * - Cria um corpo (`Corpse`) no lugar do monstro
   * - Emite eventos `MONSTER_DEATH` e `COMBAT_KILL`
   * - Agenda respawn usando os dados de spawn armazenados no mundo
   * - Notifica os clientes via WebSocket (despawn imediato e spawn futuro)
   *
   * @param monster - Monstro morto
   * @param killer - Quem matou (opcional, pode ser `Player`, `Monster` ou `undefined`)
   * @param world - Mundo (para adicionar o corpo e acessar pontos de spawn)
   * @returns {void}
   *
   * @remarks
   * O XP concedido depende da diferença de nível entre o monstro e o assassino (via `ExperienceSystem.calculateMonsterXp`).
   * O loot é gerado estocasticamente baseado nas chances definidas no JSON do monstro.
   * O corpo contém o loot e pode ser saqueado pelo jogador (tecla `G`).
   * Os eventos `MONSTER_DEATH` e `COMBAT_KILL` são emitidos para sistemas de quests, estatísticas e conquistas.
   * O respawn é agendado usando o `respawnTime` do spawn point (padrão 10 segundos).
   *
   * @example
   * ```typescript
   * // Internamente chamado por handleDeath
   * private static handleMonsterDeath(monster, killer, world) { ... }
   * ```
   */
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
    }

    // 2. Gera a lista de itens que o monstro irá dropar (ainda não coloca no mundo)
    const loot = LootSystem.generateLoot(monster);
    if (loot.length > 0) {
      Logger.loot(
        `🎁 ${monster.name} dropou: ${loot.map((i) => `${i.amount}x ${i.itemId}`).join(", ")}`,
      );
    } else {
      Logger.loot(`🎁 ${monster.name} não dropou nada.`);
    }

    // 3. Cria um corpo (entidade inerte) na posição do monstro contendo o loot
    const corpseId = generateId(); // UUID
    const corpse = new Corpse(corpseId, monster.position.x, monster.position.y, loot, killer?.id);
    world.addCorpse(corpse);

    // 4. Emite eventos para outros sistemas (ex: quests de "mate 10 ratos")
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

    // 5. Marca o monstro como morto (HP = 0). O world.cleanupDeadMonsters() irá removê‑lo posteriormente.
    monster.hp = 0;
    // =========================
    // Respawn automático (usando dados do próprio monstro)
    // =========================
    const respawnTime = monster.respawnTime;
    setTimeout(() => {
      const monsterDef = MonsterRegistry.get(monster.type.id);
      if (monsterDef) {
        const newId = generateId(); // ← UUID
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

        // Notifica todos os clientes
        const ws = WebSocketServer.getInstance();
        if (ws) {
          ws.broadcastSpawn(newMonster);
        }
      } else {
        Logger.error(`[Respawn] Definição do monstro ${monster.name} não encontrada.`);
      }
    }, respawnTime);
  }
}
