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
import { Monster } from "../entities/monster";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { SkillType } from "../../shared/enums/skillType.enum";
import { DamageType } from "../../shared/enums/damageType.enum";
import { CombatStats } from "../../shared/interfaces/combat.interface";
import { CombatDamageEventData } from "../../shared/interfaces/eventData.interface";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { Damageable } from "../../shared/interfaces/damageable.interface";
import { Creature } from "../entities/creature";
import { WebSocketServer } from "../../network/websocket/wsServer";
import { PlayerStatsSender } from "../../network/senders/playerStatsSender";

export class CombatSystem {
  /**
   * Periodic damage uses the same events and death processing as attacks.
   * DoT does not roll critical damage or grant an additional skill use.
   */
  static applyPeriodicDamage(
    target: Creature,
    amount: number,
    world: World,
    source?: Creature,
    conditionName = "Condição",
  ): number {
    if (!Number.isFinite(amount) || amount <= 0 || target.hp <= 0) return 0;
    if (target instanceof Monster &&
        (target.deathProcessed || !world.monsters.includes(target))) return 0;

    const damage = Math.min(Math.floor(amount), target.hp);
    if (damage <= 0) return 0;
    target.hp -= damage;

    EventSystem.getInstance().emit<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, {
      world,
      targetMaxHp: target.maxHp,
      attackerId: source?.id ?? `condition:${conditionName}`,
      attackerName: source?.name ?? conditionName,
      targetId: target.id,
      targetName: target.name,
      damage,
      targetHpAfter: target.hp,
    });

    if (target.hp <= 0) DeathSystem.handleDeath(target, source, world);

    if (target instanceof Player) {
      const ws = WebSocketServer.getInstance();
      if (ws) ws.sendToPlayer(target.id, JSON.stringify(PlayerStatsSender.toPayload(target)));
    }
    return damage;
  }

  /**
   * Realiza um ataque entre duas entidades e retorna o dano causado..
   *
   * @param attacker - Quem ataca (deve implementar CombatStats e Damageable)
   * @param target - Quem recebe o dano (deve implementar CombatStats e Damageable)
   * @param world - Referência ao mundo para processar morte
   * @returns {void}
   *
   * @remarks
   * O fluxo de ataque:
   * 1. Verifica se o alvo está vivo.
   * 2. Calcula dano usando a fórmula de combate (inclui chance de crítico, resistências e tipo de dano).
   * 3. Aplica o dano ao alvo.
   * 4. Emite evento de dano.
   * 5. Se o atacante for monstro, aplica efeito de ataque (ex: veneno).
   * 6. Concede progresso na skill ofensiva do atacante (se for jogador).
   * 7. Concede progresso na skill defensiva (Shielding) do alvo (se for jogador).
   * 8. Se o alvo morrer, chama o DeathSystem.
   *
   * @example
   * ```typescript
   * CombatSystem.attack(player, monster, world);
   * ```
   */
  static attack(
    attacker: Damageable & CombatStats,
    target: Damageable & CombatStats,
    world: World,
  ): number {
    // ← AGORA RETORNA NUMBER
    // Mortos não atacam; alvo morto não pode gerar dano/XP/evento extra.
    if (attacker.hp <= 0 || target.hp <= 0) return 0;
    if (target instanceof Monster && (target.deathProcessed || !world.monsters.includes(target))) return 0;

    // ----------------------------------------------------------
    // 1. Determina o tipo de dano e as resistências/weaknesses do alvo
    // ----------------------------------------------------------
    let damageType = DamageType.PHYSICAL;
    let defenderResistances: Partial<Record<DamageType, number>> | undefined;
    let defenderWeaknesses: Partial<Record<DamageType, number>> | undefined;

    if (attacker instanceof Monster && attacker.type.combat.damageType) {
      damageType = attacker.type.combat.damageType;
    }
    if (target instanceof Monster) {
      defenderResistances = target.type.resistances;
      defenderWeaknesses = target.type.weaknesses;
    }

    // ----------------------------------------------------------
    // 2. Calcula o dano usando a fórmula de combate
    // ----------------------------------------------------------
    const result = CombatFormula.calculateDamage(
      attacker,
      target,
      damageType,
      defenderResistances,
      defenderWeaknesses,
    );
    // Overkill não deve reportar mais HP perdido do que o alvo tinha.
    const finalDamage = Math.min(result.damage, target.hp);

    // ----------------------------------------------------------
    // 3. Aplica o dano ao alvo
    // ----------------------------------------------------------
    target.hp = Math.max(0, target.hp - finalDamage);

    // ==========================================================
    // 🔥 ENVIA PLAYER STATS (se o alvo for jogador)
    // ==========================================================
    if (target instanceof Player) {
      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        wsServer.sendToPlayer(target.id, JSON.stringify(PlayerStatsSender.toPayload(target)));
      }
    }

    // ----------------------------------------------------------
    // 4. Emite evento de dano
    // ----------------------------------------------------------
    EventSystem.getInstance().emit<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, {
      world,
      targetMaxHp: target.maxHp,
      attackerId: attacker.id,
      attackerName: (attacker as any).name,
      targetId: target.id,
      targetName: (target as any).name,
      damage: finalDamage,
      targetHpAfter: target.hp,
    });

    const critMsg = result.isCritical ? " (CRÍTICO!)" : "";
    Logger.combat(
      `${(attacker as any).name} causou ${finalDamage} de dano${critMsg} em ${(target as any).name} (${damageType}). ${(target as any).name} HP: ${target.hp}/${target.maxHp}`,
    );

    // ----------------------------------------------------------
    // 5. Aplica efeito de ataque do monstro (ex: veneno)
    // ----------------------------------------------------------
    if (target.hp > 0 && attacker instanceof Monster && attacker.type.combat.attackEffect) {
      const effect = attacker.type.combat.attackEffect;
      if (Math.random() < effect.chance && target instanceof Creature) {
        const duration = effect.duration;
        target.conditionManager.apply(effect.conditionId, duration, attacker);
        Logger.combat(
          `${target.name} foi afetado por ${effect.conditionId} devido ao ataque de ${attacker.name}!`,
        );
      }
    }

    // ----------------------------------------------------------
    // 6. Ganho de skill ofensiva (se atacante for jogador)
    // ----------------------------------------------------------
    if (attacker instanceof Player) {
      let skill = SkillType.SWORD;
      const weaponId = attacker.equipment.get(EquipmentSlot.WEAPON);
      if (weaponId) {
        if (weaponId.includes("sword")) skill = SkillType.SWORD;
        else if (weaponId.includes("axe")) skill = SkillType.AXE;
        else if (weaponId.includes("club")) skill = SkillType.CLUB;
        else if (weaponId.includes("bow") || weaponId.includes("arrow")) skill = SkillType.DISTANCE;
      }
      const gain = SkillConfigs[skill].gainPerUse;
      attacker.addSkillProgress(skill, gain);
    }

    // ----------------------------------------------------------
    // 7. Ganho de skill defensiva (Shielding) – apenas se o alvo for jogador
    // ----------------------------------------------------------
    if (target instanceof Player && target !== attacker) {
      const gain = SkillConfigs[SkillType.SHIELDING].gainPerUse;
      target.addSkillProgress(SkillType.SHIELDING, gain);
    }

    // ----------------------------------------------------------
    // 8. Verifica morte
    // ----------------------------------------------------------
    if (target.hp <= 0) {
      DeathSystem.handleDeath(target, attacker, world);
    }

    // ==========================================================
    // 🔥 RETORNA O DANO CAUSADO (para ser usado no broadcast)
    // ==========================================================
    return finalDamage;
  }
}
