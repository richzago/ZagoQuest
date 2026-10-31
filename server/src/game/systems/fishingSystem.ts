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
 * 1. O jogador pressiona 'r' (capturado pelo `commandHandler`).
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
export class FishingSystem {
  /**
   * Tenta iniciar a pesca para o jogador.
   * Procura automaticamente a primeira vara de pesca no inventário,
   * e a primeira isca (se existir).
   *
   * @param player - Jogador que irá pescar
   * @param world - Mundo (necessário para verificar presença de água adjacente)
   * @returns `true` se a pesca foi iniciada com sucesso, `false` caso contrário
   *
   * @remarks
   * Condições para iniciar:
   * - Jogador não pode estar já pescando.
   * - Deve possuir uma vara de pesca (cujo ID comece com `fishing/rods/`).
   * - Deve estar adjacente à água (atualmente simulado com `y >= 8`).
   * - Se houver isca (ID começando com `fishing/bait/`), ela é consumida e concede bônus.
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
  static startFishing(player: Player, world: World): boolean {
    if (player.isFishing) {
      Logger.skill(`${player.name} já está pescando. Aguarde o fim da pesca atual.`);
      return false;
    }

    let rodId: string | null = null;
    for (const [itemId] of player.inventory) {
      if (itemId.startsWith("fishing/rods/")) {
        rodId = itemId;
        break;
      }
    }
    if (!rodId) {
      Logger.skill(`Você precisa de uma vara de pesca (fishing/rods/...) para pescar.`);
      return false;
    }
    if (!player.hasItem(rodId, 1)) {
      Logger.skill(`A vara ${rodId} não está mais no seu inventário.`);
      return false;
    }

    let baitId: string | null = null;
    for (const [itemId] of player.inventory) {
      if (itemId.startsWith("fishing/bait/")) {
        baitId = itemId;
        break;
      }
    }

    if (!this.isNearWater(player, world)) {
      Logger.skill(`Você precisa estar perto da água para pescar.`);
      return false;
    }

    let baitBonus = 0;
    if (baitId) {
      if (player.hasItem(baitId, 1)) {
        player.removeItem(baitId, 1);
        const baitItem = ItemRegistry.get(baitId);
        baitBonus = (baitItem as any).fishingBonus || 0.1;
        Logger.skill(`${player.name} usou isca: ${baitItem?.name || baitId}.`);
      } else {
        Logger.skill(`Você não tem mais a isca ${baitId}.`);
        return false;
      }
    }

    const rodItem = ItemRegistry.get(rodId);
    const fishingTime = (rodItem as any).fishingTime || 3000;
    const rodBonus = (rodItem as any).fishingBonus || 0;

    player.isFishing = true;
    const timer = setTimeout(() => {
      // O callback pode ter sido enfileirado antes do cancelamento: uma
      // pescaria encerrada não pode gerar loot ou skill em outra sessão.
      if (!player.isFishing || player.fishingTimer !== timer || player.hp <= 0) return;
      player.isFishing = false;
      player.fishingTimer = undefined;
      this.completeFishing(player, rodBonus + baitBonus);
    }, fishingTime);
    player.fishingTimer = timer;

    Logger.skill(`${player.name} começou a pescar. Aguarde ${fishingTime / 1000} segundos...`);
    return true;
  }

  /**
   * Verifica se o jogador está adjacente a um tile de água.
   * Atualmente, usa simulação: considera água qualquer posição com y >= 8.
   *
   * @param player - Jogador
   * @param world - Mundo (não usado atualmente, mas preparado para futura integração com Tiled)
   * @returns `true` se estiver adjacente à água, `false` caso contrário
   *
   * @remarks
   * Esta implementação é temporária. Quando o sistema de mapas Tiled for integrado,
   * deverá verificar se o tile adjacente é do tipo "water".
   *
   * @example
   * ```typescript
   * if (FishingSystem.isNearWater(player, world)) {
   *   // Pode pescar
   * }
   * ```
   */
  private static isNearWater(player: Player, world: World): boolean {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    for (const dir of directions) {
      const x = player.position.x + dir.dx;
      const y = player.position.y + dir.dy;
      if (y >= 8) {
        return true;
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
  private static completeFishing(player: Player, totalBonus: number): void {
    const fishingSkill = player.getSkillLevel(SkillType.FISHING);
    const baseChance = 0.5;
    const adjustedChance = Math.min(0.95, baseChance + fishingSkill * 0.02 + totalBonus);
    const roll = Math.random();

    if (roll > adjustedChance) {
      const trashReward = { itemId: "consumable/old_boot", amount: 1 };
      player.addItem(trashReward.itemId, trashReward.amount);
      Logger.skill(`${player.name} pescou um(a) ${trashReward.itemId}!`);
    } else {
      const eligibleRewards = REWARDS.filter((r) => (r.minSkillLevel || 0) <= fishingSkill);
      if (eligibleRewards.length === 0) {
        player.addItem("fishing/fish/trout", 1);
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
          player.addItem(selected.itemId, amount);
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
    if (hadFishing) Logger.skill(`${player.name} cancelou a pesca.`);
  }
}
