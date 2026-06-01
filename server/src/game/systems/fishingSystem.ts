/**
 * fishingSystem.ts
 * Gerencia a mecânica de pesca: timer, sorteio de recompensas,
 * ganho de skill Fishing e uso de varas/iscas.
 */

import { Player } from "../entities/player";
import { World } from "../world/world";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { Logger } from "../core/logger/logger";
import { EventSystem } from "../core/events/eventSystem";
import { SkillType } from "../../shared/enums/skillType.enum";
import { FishingReward } from "../../shared/interfaces/fishing.interface";

/**
 * Configuração de uma recompensa de pesca.
 */

/**
 * Tabela de recompensas (peixes, itens raros).
 * Agora utilizando a nova estrutura de pastas para itens de pesca:
 * - Peixes: "fishing/fish/trout", "fishing/fish/salmon", etc.
 * - Itens raros: podem vir de outras pastas (equipment, currency, consumable).
 */
const REWARDS: FishingReward[] = [
  // Peixes comuns (qualquer nível)
  { itemId: "fishing/fish/trout", minAmount: 1, maxAmount: 1, chance: 0.35, minSkillLevel: 0 },
  { itemId: "fishing/fish/salmon", minAmount: 1, maxAmount: 1, chance: 0.25, minSkillLevel: 0 },
  { itemId: "fishing/fish/perch", minAmount: 1, maxAmount: 1, chance: 0.2, minSkillLevel: 0 },
  // Peixes raros (nível 5+)
  { itemId: "fishing/fish/golden", minAmount: 1, maxAmount: 1, chance: 0.05, minSkillLevel: 5 },
  // Itens raros (nível 10+)
  {
    itemId: "equipment/armor/scale_armor",
    minAmount: 1,
    maxAmount: 1,
    chance: 0.01,
    minSkillLevel: 10,
  },
  { itemId: "currency/platinum_coin", minAmount: 1, maxAmount: 1, chance: 0.02, minSkillLevel: 5 },
  // Lixo (sempre)
  { itemId: "consumable/old_boot", minAmount: 1, maxAmount: 1, chance: 0.1, minSkillLevel: 0 },
];

/**
 * Sistema de pesca.
 */
export class FishingSystem {
  /**
   * Tenta iniciar a pesca para o jogador.
   * Procura automaticamente a primeira vara de pesca no inventário,
   * e a primeira isca (se existir).
   * @param player Jogador
   * @param world Mundo (para verificar água)
   * @returns true se a pesca foi iniciada
   */
  static startFishing(player: Player, world: World): boolean {
    // Verifica se já está pescando
    if (player.isFishing) {
      Logger.system(`${player.name} já está pescando. Aguarde o fim da pesca atual.`);
      return false;
    }

    // --- DETECTA A VARA DE PESCA ---
    // Procura qualquer item cujo ID comece com "fishing/rods/" (nova estrutura)
    let rodId: string | null = null;
    for (const [itemId] of player.inventory) {
      if (itemId.startsWith("fishing/rods/")) {
        rodId = itemId;
        break;
      }
    }
    if (!rodId) {
      Logger.warn(`Você precisa de uma vara de pesca (fishing/rods/...) para pescar.`);
      return false;
    }
    // Verifica se ainda tem a vara no inventário (já foi confirmado pelo loop)
    if (!player.hasItem(rodId, 1)) {
      Logger.warn(`A vara ${rodId} não está mais no seu inventário.`);
      return false;
    }

    // --- DETECTA A ISCA (opcional) ---
    // Procura qualquer item cujo ID comece com "fishing/bait/"
    let baitId: string | null = null;
    for (const [itemId] of player.inventory) {
      if (itemId.startsWith("fishing/bait/")) {
        baitId = itemId;
        break;
      }
    }

    // Verifica se está na água (sistema simples: verifica tile adjacente)
    if (!this.isNearWater(player, world)) {
      Logger.system(`Você precisa estar perto da água para pescar.`);
      return false;
    }

    // Consome a isca (se encontrada) e calcula bônus
    let baitBonus = 0;
    if (baitId) {
      if (player.hasItem(baitId, 1)) {
        player.removeItem(baitId, 1);
        const baitItem = ItemRegistry.get(baitId);
        baitBonus = (baitItem as any).fishingBonus || 0.1; // +10% de chance de peixes melhores
        Logger.skill(`${player.name} usou isca: ${baitItem?.name || baitId}.`);
      } else {
        Logger.skill(`Você não tem mais a isca ${baitId}.`);
        return false;
      }
    }

    // Obtém as propriedades da vara (tempo e bônus)
    const rodItem = ItemRegistry.get(rodId);
    const fishingTime = (rodItem as any).fishingTime || 3000; // milissegundos, padrão 3s
    const rodBonus = (rodItem as any).fishingBonus || 0; // bônus extra da vara

    // Marca que o jogador está pescando
    player.isFishing = true;
    player.fishingTimer = setTimeout(() => {
      this.completeFishing(player, rodBonus + baitBonus);
      player.isFishing = false;
      player.fishingTimer = undefined;
    }, fishingTime);

    Logger.skill(`${player.name} começou a pescar. Aguarde ${fishingTime / 1000} segundos...`);
    return true;
  }

  /**
   * Verifica se o jogador está adjacente a um tile de água.
   * Por enquanto, usamos uma verificação placeholder: tiles com y >= 8 (linhas inferiores do mapa).
   * Futuramente, com Tiled, verificaremos a camada "water".
   */
  private static isNearWater(player: Player, world: World): boolean {
    // Direções adjacentes (incluindo diagonais)
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
      // Simulação: água onde y >= 8 (parte baixa do mapa) – ajuste conforme seu mapa
      // TODO: substituir por world.isWater(x,y) quando o Tiled estiver integrado
      if (y >= 8) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finaliza a pesca: calcula recompensa, adiciona ao inventário, ganha skill.
   */
  private static completeFishing(player: Player, totalBonus: number): void {
    // Obtém o nível de Fishing do jogador
    const fishingSkill = player.getSkillLevel(SkillType.FISHING);
    const baseChance = 0.5; // chance base de pegar algo (senão pega lixo)
    const adjustedChance = Math.min(0.95, baseChance + fishingSkill * 0.02 + totalBonus);
    const roll = Math.random();

    if (roll > adjustedChance) {
      // Não pegou nada (ou pegou lixo)
      const trashReward = { itemId: "consumable/old_boot", amount: 1 };
      player.addItem(trashReward.itemId, trashReward.amount);
      Logger.loot(`${player.name} pescou um(a) ${trashReward.itemId}!`);
    } else {
      // Sorteia uma recompensa baseada no nível da skill
      const eligibleRewards = REWARDS.filter((r) => (r.minSkillLevel || 0) <= fishingSkill);
      if (eligibleRewards.length === 0) {
        // Fallback: recompensa comum
        player.addItem("fishing/fish/trout", 1);
        Logger.loot(`${player.name} pescou um peixe comum.`);
      } else {
        // Sorteio com peso pela chance
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
          Logger.loot(`${player.name} pescou ${amount}x ${selected.itemId}!`);
        } else {
          player.addItem("fishing/fish/trout", 1);
        }
      }
    }

    // Ganho de progresso na skill Fishing (0.5 de progresso por pesca)
    const gain = 0.5;
    player.addSkillProgress(SkillType.FISHING, gain);
    Logger.skill(`${player.name} ganhou ${gain} de progresso em Fishing.`);

    // Dispara evento de pesca (para futuras quests)
    EventSystem.getInstance().emit("fishing:caught", {
      playerId: player.id,
      playerName: player.name,
      skillLevel: fishingSkill,
    });
  }

  /**
   * Cancela a pesca em andamento (ex: se o jogador se mover).
   */
  static cancelFishing(player: Player): void {
    if (player.isFishing && player.fishingTimer) {
      clearTimeout(player.fishingTimer);
      player.isFishing = false;
      player.fishingTimer = undefined;
      Logger.system(`${player.name} cancelou a pesca.`);
    }
  }
}
