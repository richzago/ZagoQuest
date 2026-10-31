/**
 * Única regra de entrada para ataques iniciados por jogadores.
 *
 * Handler manual e loop automático chamam este mesmo método, dividindo
 * alcance, validação de alvo e cooldown. O cliente nunca escolhe o dano.
 * A aplicação de HP, XP, morte e os eventos ficam em CombatSystem/DeathSystem.
 */
import type { Player } from "../entities/player";
import type { Monster } from "../entities/monster";
import type { World } from "../world/World";
import { CombatSystem } from "../combat/combatSystem";

export const PLAYER_ATTACK_COOLDOWN_MS = 1000;

export type AttackFailureReason =
  "Atacante morto" | "Alvo não encontrado" | "Alvo já está morto" |
  "Alvo muito longe" | "Ataque em cooldown";

export type PlayerAttackResult =
  | { ok: true; damage: number }
  | { ok: false; reason: AttackFailureReason };

export class PlayerAttackSystem {
  /**
   * Selecionar um alvo não é atacar: o jogador pode começar a segui-lo
   * de longe, mas dano continua condicionado ao alcance no tryAttack().
   */
  static validateSelectableTarget(
    player: Player, monster: Monster | undefined, world: World,
  ): AttackFailureReason | undefined {
    if (player.hp <= 0) return "Atacante morto";
    if (!monster || !world.monsters.includes(monster)) return "Alvo não encontrado";
    if (monster.hp <= 0 || monster.deathProcessed) return "Alvo já está morto";
    const coordinates = [player.position.x, player.position.y,
      monster.position.x, monster.position.y];
    if (!coordinates.every(Number.isSafeInteger)) return "Alvo não encontrado";
    return undefined;
  }

  /** Mesmo alcance físico para ataque manual e o tick automático. */
  static validateTarget(player: Player, monster: Monster | undefined, world: World): AttackFailureReason | undefined {
    const failure = this.validateSelectableTarget(player, monster, world);
    if (failure) return failure;
    if (Math.hypot(player.position.x - monster!.position.x,
      player.position.y - monster!.position.y) > 1.5) return "Alvo muito longe";
    return undefined;
  }

  static tryAttack(player: Player, monster: Monster | undefined, world: World): PlayerAttackResult {
    const failure = this.validateTarget(player, monster, world);
    if (failure) return { ok: false, reason: failure };

    if (!player.cooldownManager.isReady("attack")) {
      return { ok: false, reason: "Ataque em cooldown" };
    }

    // Só ataques válidos consomem cooldown. Ataque manual e auto compartilham.
    player.cooldownManager.addCooldown("attack", PLAYER_ATTACK_COOLDOWN_MS);
    const damage = CombatSystem.attack(player, monster!, world);
    return { ok: true, damage };
  }
}
