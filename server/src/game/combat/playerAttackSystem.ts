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

export type PlayerAttackResult =
  | { ok: true; damage: number }
  | { ok: false; reason: "Atacante morto" | "Alvo não encontrado" | "Alvo já está morto" | "Alvo muito longe" | "Ataque em cooldown" };

export class PlayerAttackSystem {
  static tryAttack(player: Player, monster: Monster | undefined, world: World): PlayerAttackResult {
    if (player.hp <= 0) return { ok: false, reason: "Atacante morto" };
    if (!monster || !world.monsters.includes(monster)) {
      return { ok: false, reason: "Alvo não encontrado" };
    }
    if (monster.hp <= 0 || monster.deathProcessed) {
      return { ok: false, reason: "Alvo já está morto" };
    }

    const positions = [player.position.x, player.position.y,
      monster.position.x, monster.position.y];
    if (!positions.every(Number.isSafeInteger) ||
        Math.hypot(player.position.x - monster.position.x,
          player.position.y - monster.position.y) > 1.5) {
      return { ok: false, reason: "Alvo muito longe" };
    }

    if (!player.cooldownManager.isReady("attack")) {
      return { ok: false, reason: "Ataque em cooldown" };
    }

    // Só ataques válidos consomem cooldown. Ataque manual e auto compartilham.
    player.cooldownManager.addCooldown("attack", PLAYER_ATTACK_COOLDOWN_MS);
    const damage = CombatSystem.attack(player, monster, world);
    return { ok: true, damage };
  }
}
