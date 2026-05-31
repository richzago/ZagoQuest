/**
 * player.ts
 * Classe que representa um jogador no mundo.
 * Herda de Creature e adiciona inventário, equipamentos e atributos derivados.
 */

import { Creature } from "./creature";
import { EquipmentSlot } from "./equipmentTypes";
import { World } from "../world/world";
import { Logger } from "../core/logger/logger";
import { EventSystem } from "../core/events/eventSystem";
import { GameEvent, ItemPickupEventData } from "../core/events/eventTypes";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { SkillType } from "../../data/skills/skillTypes";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { SkillSystem } from "../systems/skillSystem";
import { getCoinValue, isCoin } from "../systems/currencySystem";

export interface SkillState {
  level: number;
  progress: number; // 0 a 100
}

export class Player extends Creature {
  // Mapa de itens no inventário: itemId -> quantidade
  inventory: Map<string, number> = new Map();

  // Mapa de equipamentos: slot -> itemId
  equipment: Map<EquipmentSlot, string> = new Map();

  // Mapa de habilidades: SkillType -> { level, progress }
  skills: Map<SkillType, SkillState> = new Map();

  gold: number = 0;
  bankGold: number = 0;
  isFishing: boolean = false;
  fishingTimer?: NodeJS.Timeout;

  // Construtor
  constructor(id: number, name: string, x: number, y: number) {
    super(id, name, x, y, "P"); // símbolo 'P' para Player no render ASCII

    // Configuração inicial dos atributos (podem ser sobrescritos pelo save)
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.maxMana = 50;
    this.mana = this.maxMana;
    this.level = 1;
    this.experience = 0;
    this.gold = 500;
    this.bankGold = 0;
    this.isFishing = false;
    this.fishingTimer = undefined;
    // =========================
    // INICIALIZAÇÃO DAS SKILLS
    // =========================
    // Percorre todos os tipos de skill definidos e cria o estado inicial
    for (const skill of Object.values(SkillType)) {
      const config = SkillConfigs[skill];
      this.skills.set(skill, {
        level: config.baseLevel,
        progress: config.baseProgress,
      });
    }

    // Chama o recálculo de atributos (usa equipamentos e nível)
    this.recalculateStats();
  }

  /**
   * Recalcula todos os atributos de combate baseados nos equipamentos e nível.
   * Os valores são atribuídos diretamente às propriedades herdadas de Creature.
   * É chamado sempre que equipa/desequipa ou sobe de nível.
   */
  recalculateStats(): void {
    // Valores base (futuramente podem vir da vocação)
    let attack = 5;
    let defense = 0;
    let armor = 0;
    let critChance = 0;
    let critMulti = 1.5;

    // Percorre todos os equipamentos e soma os bônus
    for (const [slot, itemId] of this.equipment) {
      const item = ItemRegistry.get(itemId);
      if (item && item.bonuses) {
        attack += item.bonuses.attack || 0;
        defense += item.bonuses.defense || 0;
        armor += item.bonuses.armor || 0;
        critChance += item.bonuses.criticalChance || 0;
        if (item.bonuses.criticalMultiplier) critMulti = item.bonuses.criticalMultiplier;
      }
    }

    // Bônus de nível: +1 attack a cada 5 níveis
    attack += Math.floor(this.level / 5);

    // Aplica os valores às propriedades da classe base (Creature)
    this.attack = Math.max(1, attack);
    this.defense = Math.max(0, defense);
    this.armor = Math.max(0, armor);
    this.criticalChance = Math.min(100, critChance);
    this.criticalMultiplier = Math.max(1.0, critMulti);
  }

  // Adicione este método na classe Player (em player.ts)
  addSkillProgress(skill: SkillType, amount: number): void {
    SkillSystem.addProgress(this, skill, amount);
  }

  /**
   * Equipa um item (move do inventário para o slot correspondente).
   * @param itemId ID completo do item (ex: "equipment/weapon/swords/boneSword")
   * @returns true se equipou com sucesso
   */
  equipItem(itemId: string): boolean {
    const item = ItemRegistry.get(itemId);
    if (!item || item.type !== "equipment") {
      Logger.warn(`Não é possível equipar ${itemId}: não é um equipamento.`);
      return false;
    }
    const slot = item.slot;
    if (!slot) return false;

    // Verifica nível mínimo
    if (item.levelRequired && this.level < item.levelRequired) {
      Logger.warn(`Nível ${item.levelRequired} necessário para equipar ${item.name}.`);
      return false;
    }

    // Remove do inventário (1 unidade)
    if (!this.removeItem(itemId, 1)) {
      Logger.warn(`Você não possui ${item.name} para equipar.`);
      return false;
    }

    // Se já tem algo no slot, devolve para o inventário
    const currentItemId = this.equipment.get(slot);
    if (currentItemId) {
      this.addItem(currentItemId, 1);
    }

    this.equipment.set(slot, itemId);
    this.recalculateStats();
    Logger.system(`${this.name} equipou ${item.name}.`);
    return true;
  }

  /**
   * Desequipa o item de um slot (move de volta para o inventário).
   * @param slot Slot a ser desequipado
   * @returns true se removeu com sucesso
   */
  unequipSlot(slot: EquipmentSlot): boolean {
    const itemId = this.equipment.get(slot);
    if (!itemId) {
      Logger.system(`Nada equipado no slot ${slot}.`);
      return false;
    }
    this.equipment.delete(slot);
    this.addItem(itemId, 1);
    this.recalculateStats();
    Logger.system(`${this.name} removeu ${itemId} do slot ${slot}.`);
    return true;
  }

  // =========================
  // INVENTÁRIO
  // =========================

  /**
   * Adiciona uma quantidade de um item ao inventário.
   * Dispara evento ITEM_PICKUP.
   */
  addItem(itemId: string, amount: number): void {
    const current = this.inventory.get(itemId) || 0;

    if (isCoin(itemId)) {
      const totalGold = getCoinValue(itemId) * amount;
      this.gold += totalGold;
      Logger.loot(
        `${this.name} recebeu ${amount}x ${itemId} (${totalGold} gold). Total gold: ${this.gold}`,
      );
      return;
    }
    this.inventory.set(itemId, current + amount);

    EventSystem.getInstance().emit<ItemPickupEventData>(GameEvent.ITEM_PICKUP, {
      playerId: this.id,
      playerName: this.name,
      itemId: itemId,
      amount: amount,
    });

    Logger.loot(`${this.name} recebeu ${amount}x ${itemId}`);
  }

  /**
   * Remove uma quantidade de um item do inventário.
   * @returns true se havia quantidade suficiente e removeu
   */
  removeItem(itemId: string, amount: number): boolean {
    const current = this.inventory.get(itemId) || 0;
    if (current < amount) return false;
    const newAmount = current - amount;
    if (newAmount === 0) this.inventory.delete(itemId);
    else this.inventory.set(itemId, newAmount);
    return true;
  }

  /**
   * Verifica se o jogador possui pelo menos uma quantidade de um item.
   */
  hasItem(itemId: string, amount: number): boolean {
    return (this.inventory.get(itemId) || 0) >= amount;
  }

  /**
   * Exibe o conteúdo do inventário no log.
   */
  showInventory(): void {
    if (this.inventory.size === 0) {
      Logger.warn(`${this.name} não possui nenhum item.`);
      return;
    }
    const itemsList = Array.from(this.inventory.entries())
      .map(([id, qty]) => `${qty}x ${id}`)
      .join(", ");
    Logger.loot(`🎒 Inventário: ${itemsList}`);
  }

  /**
   * Exibe os equipamentos atuais e os atributos derivados.
   */
  showEquipment(): void {
    if (this.equipment.size === 0) {
      Logger.warn(`${this.name} não está usando nenhum equipamento.`);
      return;
    }
    const equipList = Array.from(this.equipment.entries())
      .map(([slot, id]) => `${slot}: ${id}`)
      .join(", ");
    Logger.system(`⚔️ Equipamentos: ${equipList}`);
    Logger.system(
      `📊 Atributos: Atk=${this.attack}, Def=${this.defense}, Armor=${this.armor}, Crit=${this.criticalChance}% (${this.criticalMultiplier}x)`,
    );
  }

  // Métodos auxiliares para gold
  addGold(amount: number): void {
    this.gold += amount;
  }
  removeGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  // Método auxiliar
  getSkillLevel(skill: SkillType): number {
    return this.skills.get(skill)?.level ?? 1;
  }

  // =========================
  // IMPLEMENTAÇÃO DOS MÉTODOS ABSTRATOS DE CREATURE
  // =========================
  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMana(): number {
    return this.maxMana;
  }
}
