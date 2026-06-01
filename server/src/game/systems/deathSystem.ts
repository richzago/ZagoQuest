import { Logger } from "../core/logger/logger";
import { Player } from "../entities/player";
import { Monster } from "../entities/monster";;
import { World } from "../world/world";
import { ExperienceSystem } from "./experienceSystem";
import { LootSystem } from "./lootSystem";
import { Corpse } from "../entities/corpse";
import { EventSystem } from "../core/events/eventSystem";
import { CombatKillEventData, MonsterDeathEventData, PlayerDeathEventData } from "../../shared/interfaces/eventData.interface";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { Damageable } from "../../shared/interfaces/damageable.interface";

export class DeathSystem {
  static handleDeath(victim: Damageable, killer: Damageable | undefined, world: World): void {
    if (victim.hp > 0) return;

    Logger.combat(`💀 ${victim.name} morreu.`);

    if (victim instanceof Player) {
      this.handlePlayerDeath(victim);
    } else if (victim instanceof Monster) {
      this.handleMonsterDeath(victim, killer, world);
    }
  }
  private static handlePlayerDeath(player: Player, killer?: Damageable): void {
    // Aplica penalidade de XP
    const xpLoss = Math.max(1, Math.floor(player.xp * 0.1));
    player.xp = Math.max(0, player.xp - xpLoss);
    Logger.skill(`${player.name} perdeu ${xpLoss} XP. XP restante: ${player.xp}`);

    // Emitir evento de morte do jogador (após penalidade, antes do respawn)
    const eventSystem = EventSystem.getInstance();
    eventSystem.emit<PlayerDeathEventData>(GameEvent.PLAYER_DEATH, {
      playerId: player.id,
      playerName: player.name,
      killerId: killer?.id,
      killerName: killer?.name,
    });

    // Respawn
    player.position = { x: 0, y: 0 };
    player.hp = player.maxHp;
    Logger.system(`${player.name} renasceu em (0,0) com HP total.`);
  }

  private static handleMonsterDeath(
    monster: Monster,
    killer: Damageable | undefined,
    world: World,
  ): void {
    // 1. Concede XP se o killer for jogador
    if (killer instanceof Player) {
      const monsterLevel = (monster.type as any).level || 1;
      const baseXp = monster.type.combat.xp;
      const xpGained = ExperienceSystem.calculateMonsterXp(monsterLevel, killer.level, baseXp);
      ExperienceSystem.addXp(killer, xpGained);
      Logger.skill(`${killer.name} ganhou ${xpGained} XP por matar ${monster.name}.`);
    }

    // 2. Gera os itens que o monstro vai dropar (sem colocar no chão ainda)
    const loot = LootSystem.generateLoot(monster);

    if (loot.length > 0) {
      Logger.loot(
        `🎁 ${monster.name} dropou: ${loot.map((i) => `${i.amount}x ${i.itemId}`).join(", ")}`,
      );
    } else {
      Logger.loot(`🎁 ${monster.name} não dropou nada.`);
    }

    // 3. Cria um corpo na posição do monstro com esse loot
    const corpse = new Corpse(
      Date.now(), // ID simples
      monster.position.x,
      monster.position.y,
      loot,
      killer?.id,
    );
    world.addCorpse(corpse);

    // 4. Emite eventos (agora, antes de marcar hp=0, mas já com todas informações)
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

    // 5. Marca como morto (será removido pelo cleanupDeadMonsters)
    monster.hp = 0;
  }
}
