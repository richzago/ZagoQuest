import { World } from "../world/world";
import { Logger } from "../core/logger/logger";
import { DeathSystem } from "../systems/deathSystem";
import { EventSystem } from "../core/events/eventSystem";
import { CombatDamageEventData, GameEvent } from "../core/events/eventTypes";
import { Damageable } from "./damageable";
import { CombatFormula } from "../systems/combatFormula";
import { CombatStats } from "./combatStats";
import { Creature } from "../entities/creature";
import { Player } from "../entities/player"; // ← IMPORTAR PLAYER
import { SkillType } from "../../data/skills/skillTypes";
import { SkillConfigs } from "../../data/skills/skillConfig"; // ← IMPORTAR SKILL CONFIGS
import { EquipmentSlot } from "../entities/equipmentTypes"; // ← PARA DETECTAR ARMA

export class CombatSystem {
  /**
   * Realiza um ataque entre duas entidades.
   * @param attacker Quem ataca (deve implementar CombatStats e Damageable)
   * @param target Quem recebe o dano (deve implementar CombatStats e Damageable)
   * @param world Referência ao mundo para processar morte
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
