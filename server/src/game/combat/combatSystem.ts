/**
 * combatSystem.ts
 *
 * Sistema central de combate do jogo.
 * Responsável por aplicar dano, calcular críticos, disparar eventos e atualizar skills.
 *
 * @module game/combat/CombatSystem
 */

import { World } from "../world/World";
import { Logger } from "../core/logger/logger";
import { DeathSystem } from "../systems/deathSystem";
import { EventSystem } from "../core/events/eventSystem";
import { CombatFormula } from "../systems/combatFormula";
import { Player } from "../entities/player";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { SkillType } from "../../shared/enums/skillType.enum";
import { CombatStats } from "../../shared/interfaces/combat.interface";
import { CombatDamageEventData } from "../../shared/interfaces/eventData.interface";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { Damageable } from "../../shared/interfaces/damageable.interface";

export class CombatSystem {
  /**
   * Realiza um ataque entre duas entidades.
   *
   * @param attacker - Quem ataca (deve implementar CombatStats e Damageable)
   * @param target - Quem recebe o dano (deve implementar CombatStats e Damageable)
   * @param world - Referência ao mundo para processar morte
   * @returns {void}
   *
   * @remarks
   * O fluxo de ataque:
   * 1. Verifica se o alvo está vivo.
   * 2. Calcula dano usando a fórmula de combate (inclui chance de crítico).
   * 3. Aplica o dano ao alvo.
   * 4. Emite evento de dano.
   * 5. Concede progresso na skill ofensiva do atacante (se for jogador).
   * 6. Concede progresso na skill defensiva (Shielding) do alvo (se for jogador).
   * 7. Se o alvo morrer, chama o DeathSystem.
   *
   * @example
   * ```typescript
   * // No jogo, quando um jogador ataca um monstro:
   * CombatSystem.attack(player, monster, world);
   * ```
   */
  static attack(
    attacker: Damageable & CombatStats,
    target: Damageable & CombatStats,
    world: World,
  ): void {
    if (target.hp <= 0) return;

    // Calcula dano usando a fórmula de combate
    const result = CombatFormula.calculateDamage(attacker, target);
    const finalDamage = result.damage;

    // Aplica dano
    target.hp = Math.max(0, target.hp - finalDamage);

    // Emite evento de dano
    EventSystem.getInstance().emit<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, {
      attackerId: attacker.id,
      attackerName: (attacker as any).name,
      targetId: target.id,
      targetName: (target as any).name,
      damage: finalDamage,
      targetHpAfter: target.hp,
    });

    const critMsg = result.isCritical ? " (CRÍTICO!)" : "";
    Logger.combat(
      `${(attacker as any).name} causou ${finalDamage} de dano${critMsg} em ${(target as any).name}. ${(target as any).name} HP: ${target.hp}/${target.maxHp}`,
    );

    // =========================
    // GANHO DE SKILL OFENSIVA (para o atacante)
    // =========================
    if (attacker instanceof Player) {
      // Detecta qual skill usar baseada na arma equipada (ou padrão SWORD)
      let skill = SkillType.SWORD;
      const weaponId = attacker.equipment.get(EquipmentSlot.WEAPON);
      if (weaponId) {
        if (weaponId.includes("sword")) skill = SkillType.SWORD;
        else if (weaponId.includes("axe")) skill = SkillType.AXE;
        else if (weaponId.includes("club")) skill = SkillType.CLUB;
        else if (weaponId.includes("bow") || weaponId.includes("arrow")) skill = SkillType.DISTANCE;
      }
      const gain = SkillConfigs[skill].gainPerUse;
      // Chama o método do Player (precisa existir)
      attacker.addSkillProgress(skill, gain);
    }

    // =========================
    // GANHO DE SKILL DEFENSIVA (para o alvo, se for Player)
    // =========================
    if (target instanceof Player && target !== attacker) {
      const gain = SkillConfigs[SkillType.SHIELDING].gainPerUse;
      target.addSkillProgress(SkillType.SHIELDING, gain);
    }

    // Verifica morte
    if (target.hp <= 0) {
      DeathSystem.handleDeath(target, attacker, world);
    }
  }
}
