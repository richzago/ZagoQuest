/**
 * deathSystem.ts
 *
 * Gerencia a morte de entidades (jogadores e monstros).
 *
 * - Jogador: perde 10% do XP (penalidade), emite evento, respawn na posição (0,0) com HP cheio.
 * - Monstro: concede XP ao killer, gera loot, cria um corpo (Corpse) no lugar, emite eventos de morte e abate.
 *
 * O sistema usa o EventSystem para notificar outros sistemas (ex: quests, conquistas).
 */

import { Logger } from "../core/logger/logger";
import { Player } from "../entities/player";
import { Monster } from "../entities/monster";
import { World } from "../world/world";
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

export class DeathSystem {
  /**
   * Ponto de entrada para qualquer morte.
   * Verifica o tipo da vítima e chama o handler apropriado.
   *
   * @param victim - Quem morreu (Player ou Monster)
   * @param killer - Quem causou a morte (opcional)
   * @param world - Mundo (necessário para criar corpo e remover entidade)
   */
  static handleDeath(victim: Damageable, killer: Damageable | undefined, world: World): void {
    // Se a vítima ainda tem HP, não está morta (proteção contra chamadas indevidas)
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
   * - Emite evento de morte
   * - Respawn na posição (0,0) com HP total
   *
   * @param player - Jogador morto
   * @param killer - Quem matou (pode ser monstro, outro player, etc.)
   */
  private static handlePlayerDeath(player: Player, killer?: Damageable): void {
    // Penalidade: perde 10% do XP atual (mínimo 1)
    const xpLoss = Math.max(1, Math.floor(player.xp * 0.1));
    player.xp = Math.max(0, player.xp - xpLoss);
    Logger.skill(`${player.name} perdeu ${xpLoss} XP. XP restante: ${player.xp}`);

    // Notifica outros sistemas via evento
    const eventSystem = EventSystem.getInstance();
    eventSystem.emit<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, {
      playerId: player.id,
      playerName: player.name,
      killerId: killer?.id,
      killerName: killer?.name,
    });

    // Respawn simples (teleporte para origem e HP cheio)
    player.position = { x: 0, y: 0 };
    player.hp = player.maxHp;
    Logger.system(`${player.name} renasceu em (0,0) com HP total.`);
  }

  /**
   * Processa a morte de um monstro.
   * - Concede XP ao killer (se for jogador)
   * - Gera o loot (via LootSystem)
   * - Cria um corpo (Corpse) no lugar do monstro
   * - Emite eventos de morte e abate
   * - Marca o monstro como morto (HP = 0, será removido posteriormente pelo cleanup)
   *
   * @param monster - Monstro morto
   * @param killer - Quem matou (opcional)
   * @param world - Mundo (para adicionar corpo)
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
    const corpse = new Corpse(Date.now(), monster.position.x, monster.position.y, loot, killer?.id);
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
  }
}
