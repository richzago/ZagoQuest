/**
 * fishingSystem.ts
 *
 * Gerencia a mecânica de pesca: timer, sorteio de recompensas,
 * ganho de skill Fishing e uso de varas/iscas.
 *
 * @module game/systems/FishingSystem
 */

import { Player } from "../entities/player";
import { World } from "../world/World";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { SkillType } from "../../shared/enums/skillType.enum";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { Logger } from "../core/logger/logger";
import { EventSystem } from "../core/events/eventSystem";
import { FishingReward } from "../../shared/interfaces/fishing.interface";

/**
 * Tabela de recompensas de pesca.
 * Cada entrada contém:
 * - `itemId`: ID do item (peixe, tesouro, lixo)
 * - `minAmount` / `maxAmount`: faixa de quantidade (geralmente 1)
 * - `chance`: probabilidade de obter este item (0 a 1)
 * - `minSkillLevel`: nível mínimo de Fishing necessário para ter chance de obter este item
 *
 * A soma das chances não precisa ser 1; o sistema sorteia um item com peso baseado na chance.
 */
const REWARDS: FishingReward[] = [
  { itemId: "fishing/fish/trout", minAmount: 1, maxAmount: 1, chance: 0.35, minSkillLevel: 0 },
  { itemId: "fishing/fish/salmon", minAmount: 1, maxAmount: 1, chance: 0.25, minSkillLevel: 0 },
  { itemId: "fishing/fish/perch", minAmount: 1, maxAmount: 1, chance: 0.2, minSkillLevel: 0 },
  { itemId: "fishing/fish/golden", minAmount: 1, maxAmount: 1, chance: 0.05, minSkillLevel: 5 },
  {
    itemId: "equipment/armor/scale_armor",
    minAmount: 1,
    maxAmount: 1,
    chance: 0.01,
    minSkillLevel: 10,
  },
  { itemId: "currency/platinum_coin", minAmount: 1, maxAmount: 1, chance: 0.02, minSkillLevel: 5 },
  { itemId: "consumable/old_boot", minAmount: 1, maxAmount: 1, chance: 0.1, minSkillLevel: 0 },
];

/**
 * Sistema de pesca.
 * Permite ao jogador pescar itens (peixes, tesouros, lixo) com base na sua skill Fishing.
 * Utiliza timer, consome iscas opcionais, e concede progresso na skill.
 *
 * @remarks
 * O fluxo de pesca:
 * 1. O jogador pressiona R no Unity (startFishing validado pelo WS).
 * 2. `startFishing` verifica se há vara, isca e água.
 * 3. Um timer é iniciado com duração baseada na vara.
 * 4. Ao final do timer, `completeFishing` sorteia uma recompensa com base na skill e bônus.
 * 5. O jogador recebe o item e ganha progresso em Fishing.
 *
 * @example
 * ```typescript
 * // No handler da tecla 'r'
 * FishingSystem.startFishing(player, world);
 * ```
 */
/** UI callback transport is optional; domain fishing remains reusable in unit tests. */
type FishingCatch = { itemId: string; amount: number } | null;
type FishingHooks = { onComplete?: (caught: FishingCatch) => void; onCancel?: () => void };
const activeFishingHooks = new WeakMap<Player, FishingHooks>();
const activeFishingDuration = new WeakMap<Player, number>();

export class FishingSystem {
  static durationMs(player: Player): number {
    return activeFishingDuration.get(player) ?? 0;
  }

  /**
   * Tenta iniciar a pesca para o jogador.
   * Exige vara equipada em Weapon e isca selecionada no Useful.
   *
   * @param player - Jogador que irá pescar
   * @param world - Mundo (necessário para verificar presença de água adjacente)
   * @returns `true` se a pesca foi iniciada com sucesso, `false` caso contrário
   *
   * @remarks
   * Condições para iniciar:
   * - Jogador não pode estar já pescando.
   * - Vara em WEAPON e isca em USEFUL (cada tentativa consome uma isca).
   * - Deve haver água marcada no Tiled adjacente (Y invertido no MapLoader).
   *
   * Após iniciar, define um timer que chamará `completeFishing` após o tempo configurado na vara.
   *
   * @example
   * ```typescript
   * const success = FishingSystem.startFishing(player, world);
   * if (success) {
   *   console.log("Você começou a pescar!");
   * }
   * ```
   */
  static startFishing(player: Player, world: World, hooks: FishingHooks = {}): boolean {
    if (player.isFishing) {
      Logger.skill(`${player.name} já está pescando. Aguarde o fim da pesca atual.`);
      return false;
    }

    // Requisitos de MMO: rod em WEAPON, bait em USEFUL.
    // O slot Useful seleciona o TIPO de isca; a primeira unidade equipada
    // é consumida por último, depois das unidades restantes no inventário.
    const rodId = player.equipment.get(EquipmentSlot.WEAPON);
    const baitId = player.equipment.get(EquipmentSlot.USEFUL);
    if (!rodId?.startsWith("fishing/rods/") || !baitId ||
        !(baitId.startsWith("fishing/baits/") || baitId === "consumable/bait_worm")) {
      Logger.skill(`${player.name}: equipe vara em Weapon e isca em Useful.`);
      return false;
    }
    let rodItem, baitItem;
    try {
      rodItem = ItemRegistry.get(rodId);
      baitItem = ItemRegistry.get(baitId);
    } catch {
      Logger.warn("[FISHING] Vara ou isca equipada não existe no ItemRegistry.");
      return false;
    }
    if (rodItem.type !== "equipment" || rodItem.slot !== EquipmentSlot.WEAPON ||
        baitItem.type !== "equipment" || baitItem.slot !== EquipmentSlot.USEFUL) {
      Logger.skill("Equipamento inválido para pesca.");
      return false;
    }

    // Validar água REAL da layer Ground do Tiled antes de gastar isca.
    if (!this.isNearWater(player, world)) {
      Logger.skill(`${player.name}: nenhum tile de água Tiled adjacente.`);
      return false;
    }

    const fishingTime = rodItem.fishingTime ?? 3000;
    const rodBonus = rodItem.fishingBonus ?? 0;
    const baitBonus = baitItem.fishingBonus ?? 0;
    if (!Number.isSafeInteger(fishingTime) || fishingTime < 100 ||
        !Number.isFinite(rodBonus) || rodBonus < 0 ||
        !Number.isFinite(baitBonus) || baitBonus < 0) {
      Logger.warn("[FISHING] JSON de vara/isca possui configuração inválida.");
      return false;
    }

    // Economia segura: o slot Useful contém uma unidade 'reservada'.
    // Enquanto há outras na mochila, gastar da mochila mantendo a seleção.
    // Na última, gastar a própria unidade equipada e liberar o slot Useful.
    if (player.hasItem(baitId, 1)) {
      if (!player.removeItem(baitId, 1)) return false;
    } else {
      player.equipment.delete(EquipmentSlot.USEFUL);
      player.recalculateStats();
    }

    player.isFishing = true;
    const timer = setTimeout(() => {
      // O callback pode ter sido enfileirado antes do cancelamento: uma
      // pescaria encerrada não pode gerar loot ou skill em outra sessão.
      if (!player.isFishing || player.fishingTimer !== timer || player.hp <= 0) return;
      player.isFishing = false;
      player.fishingTimer = undefined;
      activeFishingDuration.delete(player);
      activeFishingHooks.delete(player);
      const caught = this.completeFishing(player, rodBonus + baitBonus);
      hooks.onComplete?.(caught);
    }, fishingTime);
    player.fishingTimer = timer;
    activeFishingDuration.set(player, fishingTime);
    activeFishingHooks.set(player, hooks);

    Logger.skill(`${player.name} começou a pescar. Aguarde ${fishingTime / 1000} segundos...`);
    return true;
  }

  /** Uma das oito células adjacentes precisa conter água no WORLD, não Y>=8. */
  static isNearWater(player: Player, world: World): boolean {
    const px = player.position.x, py = player.position.y;
    if (!world.isWithinBounds(px, py) || !world.getTile(px, py)?.walkable) return false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (world.getTile(px + dx, py + dy)?.isWater === true) return true;
      }
    }
    return false;
  }

  /**
   * Finaliza a pesca após o timer: calcula recompensa, adiciona ao inventário, concede progresso na skill.
   *
   * @param player - Jogador que pescou
   * @param totalBonus - Bônus combinado da vara e isca (aumenta a chance de pegar itens melhores)
   * @returns {void}
   *
   * @remarks
   * O processo:
   * 1. Calcula a chance ajustada com base no nível de Fishing e bônus.
   * 2. Sorteia se o jogador pega algo (caso contrário, pega lixo).
   * 3. Se pegar algo, filtra as recompensas elegíveis (minSkillLevel ≤ fishingSkill) e sorteia uma com peso.
   * 4. Adiciona o item ao inventário.
   * 5. Ganha 0.5 de progresso na skill Fishing.
   * 6. Emite evento `fishing:caught` (para futuros sistemas de estatísticas/conquistas).
   *
   * @example
   * ```typescript
   * // Chamado internamente pelo timer
   * FishingSystem.completeFishing(player, 0.15);
   * ```
   */
  private static completeFishing(player: Player, totalBonus: number): FishingCatch {
    let caught: FishingCatch = null;
    const fishingSkill = player.getSkillLevel(SkillType.FISHING);
    const baseChance = 0.5;
    const adjustedChance = Math.min(0.95, baseChance + fishingSkill * 0.02 + totalBonus);
    const roll = Math.random();

    if (roll > adjustedChance) {
      const trashReward = { itemId: "consumable/old_boot", amount: 1 };
      if (player.addItem(trashReward.itemId, trashReward.amount)) caught = trashReward;
      Logger.skill(`${player.name} pescou um(a) ${trashReward.itemId}!`);
    } else {
      const eligibleRewards = REWARDS.filter((r) => (r.minSkillLevel || 0) <= fishingSkill);
      if (eligibleRewards.length === 0) {
        if (player.addItem("fishing/fish/trout", 1))
          caught = { itemId: "fishing/fish/trout", amount: 1 };
        Logger.loot(`${player.name} pescou um peixe comum.`);
      } else {
        const totalChance = eligibleRewards.reduce((sum, r) => sum + r.chance, 0);
        let random = Math.random() * totalChance;
        let selected: FishingReward | undefined;
        for (const reward of eligibleRewards) {
          random -= reward.chance;
          if (random <= 0) {
            selected = reward;
            break;
          }
        }
        if (selected) {
          const amount =
            selected.minAmount === selected.maxAmount
              ? selected.minAmount
              : selected.minAmount +
                Math.floor(Math.random() * (selected.maxAmount - selected.minAmount + 1));
          if (player.addItem(selected.itemId, amount))
            caught = { itemId: selected.itemId, amount };
          Logger.skill(`${player.name} pescou ${amount}x ${selected.itemId}!`);
        } else {
          player.addItem("fishing/fish/trout", 1);
        }
      }
    }

    const gain = 0.5;
    player.addSkillProgress(SkillType.FISHING, gain);
    Logger.skill(`${player.name} ganhou ${gain} de progresso em Fishing.`);

    EventSystem.getInstance().emit("fishing:caught", {
      playerId: player.id,
      playerName: player.name,
      skillLevel: fishingSkill,
    });
    return caught;
  }

  /**
   * Cancela a pesca em andamento (ex: se o jogador se mover).
   *
   * @param player - Jogador que está pescando
   * @returns {void}
   *
   * @remarks
   * O timer é cancelado e a flag `isFishing` é redefinida.
   * Deve ser chamado antes de qualquer movimento do jogador para evitar que ele se mova enquanto pesca.
   *
   * @example
   * ```typescript
   * // No handler de movimento, antes de mover
   * if (player.isFishing) {
   *   FishingSystem.cancelFishing(player);
   * }
   * player.move(dx, dy, world);
   * ```
   */
  static cancelFishing(player: Player): void {
    const hadFishing = player.isFishing || player.fishingTimer !== undefined;
    if (player.fishingTimer) clearTimeout(player.fishingTimer);
    player.fishingTimer = undefined;
    player.isFishing = false;
    activeFishingDuration.delete(player);
    const hooks = activeFishingHooks.get(player);
    activeFishingHooks.delete(player);
    if (hadFishing) hooks?.onCancel?.();
    if (hadFishing) Logger.skill(`${player.name} cancelou a pesca.`);
  }
}
