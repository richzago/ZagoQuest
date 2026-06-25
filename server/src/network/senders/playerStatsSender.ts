// network/senders/playerStatsSender.ts
import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { BaseSender } from "./base/baseSender";
import { ExperienceSystem } from "../../game/systems/experienceSystem";

export class PlayerStatsSender extends BaseSender {
  public sendPlayerStats(player: Player): void {
    // Garante que as stats estão atualizadas
    player.recalculateStats();

    const nextLevelXp = ExperienceSystem.getRequiredXp(player.level);

    this.send({
      type: "playerStats",
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      level: player.level,
      attack: player.attack,
      defense: player.defense,
      armor: player.armor,
      experience: player.experience,
      experienceToNext: nextLevelXp,
    });
  }

  public static send(ws: WebSocket, player: Player): void {
    const sender = new PlayerStatsSender(ws);
    sender.sendPlayerStats(player);
  }
}
