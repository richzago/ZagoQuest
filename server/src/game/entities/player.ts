/**
 * player.ts
 *
 * Classe que representa um jogador no mundo.
 * Herda de Creature e adiciona inventário, equipamentos, habilidades, sistema financeiro e estado de pesca.
 *
 * @module game/entities/Player
 */

import { Creature } from "./creature";
import { Logger } from "../core/logger/logger";
import { EventSystem } from "../core/events/eventSystem";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { SkillConfigs } from "../../data/skills/skillConfig";
import { SkillSystem } from "../systems/skillSystem";
import { getCoinValue, isCoin } from "../systems/currencySystem";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { SkillType } from "../../shared/enums/skillType.enum";
import { SkillState } from "../../shared/interfaces/playerSave.interface";
import { ItemPickupEventData } from "../../shared/interfaces/eventData.interface";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import { Vocation } from "../../shared/enums/vocation.enum";
import { VocationSystem } from "../systems/vocationSystem";
import { ExperienceSystem } from "../systems/experienceSystem";
import { canCreditGold, isValidGoldBalance, isValidItemId, isValidQuantity } from "../systems/economyRules";

export class Player extends Creature {
  // =========================
  // PROPRIEDADES PÚBLICAS
  // =========================

  /** Mapa de itens no inventário: itemId → quantidade */
  inventory: Map<string, number> = new Map();

  /** Mapa de equipamentos: slot → itemId */
  equipment: Map<EquipmentSlot, string> = new Map();

  /** Mapa de habilidades: SkillType → { level, progress } */
  skills: Map<SkillType, SkillState> = new Map();

  /** Dinheiro em mãos (gold) */
  gold: number = 0;

  /** Dinheiro depositado no banco */
  bankGold: number = 0;

  /** Indica se o jogador está no processo de pesca (para cancelar ao mover) */
  isFishing: boolean = false;

  /** Timer da pesca em andamento (para cancelamento) */
  fishingTimer?: NodeJS.Timeout;

  /** Gênero do personagem ('M' ou 'F') */
  gender: "M" | "F" = "M";

  /** Nome do mundo (futuro para separação de servidores) */
  world: string = "main";

  vocation: Vocation = Vocation.NONE; // versão atual da vocação do jogador
  promotionStage: number = 0; // para futuras promoções de vocação
  currentTargetId?: string;

  // =========================
  // ATRIBUTOS DE PROGRESSÃO
  // =========================

  /** XP acumulado atual: não é gasto quando o jogador sobe de nível. */
  experience: number = 0;

  /** Todo XP recebido ao longo da vida, inclusive o perdido em mortes. */
  lifetimeExperience: number = 0;

  /** XP total exigido para chegar ao próximo nível (valor absoluto). */
  experienceToNext: number = 0;

  // =========================
  // CONSTRUTOR
  // =========================

  /**
   * Cria um novo jogador.
   *
   * @param id - Identificador único
   * @param name - Nome do jogador
   * @param x - Posição X inicial no mundo
   * @param y - Posição Y inicial no mundo
   *
   * @remarks
   * Valores iniciais:
   * - HP: 100, Mana: 50
   * - Level: 1, XP: 0
   * - Gold: 0 (inicial), BankGold: 0
   * - Skills inicializadas com base no SkillConfigs
   * - Atributos de combate recalculados
   *
   * @example
   * ```typescript
   * const player = new Player("1", "Hero", 2, 2);
   * world.addPlayer(player);
   * ```
   */
  constructor(id: string, name: string, x: number, y: number) {
    super(id, name, x, y);

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.maxMana = 50;
    this.mana = this.maxMana;
    this.level = 1;
    this.experience = 0;
    this.lifetimeExperience = 0;
    this.gold = 0;
    this.bankGold = 0;
    this.isFishing = false;
    this.fishingTimer = undefined;
    this.vocation = Vocation.NONE;
    this.promotionStage = 0;

    // Inicializa experiência necessária para o próximo nível
    this.experienceToNext = ExperienceSystem.getRequiredXp(this.level);

    // =========================
    // INICIALIZAÇÃO DAS SKILLS
    // =========================
    for (const skill of Object.values(SkillType)) {
      const config = SkillConfigs[skill];
      this.skills.set(skill, {
        level: config.baseLevel,
        progress: config.baseProgress,
      });
    }

    this.recalculateStats();
  }

  // =========================
  // ATRIBUTOS DE COMBATE (RECÁLCULO)
  // =========================

  /**
   * Recalcula todos os atributos de combate baseados nos equipamentos e nível.
   * Os valores são atribuídos diretamente às propriedades herdadas de Creature.
   * É chamado sempre que equipa/desequipa ou sobe de nível.
   *
   * @returns {void}
   *
   * @remarks
   * A fórmula básica:
   * - Attack = 5 + bônus de equipamentos + Math.floor(level/5)
   * - Defense, Armor, CriticalChance, CriticalMultiplier = soma dos bônus dos equipamentos
   *
   * @example
   * ```typescript
   * // Após equipar uma espada:
   * player.recalculateStats();
   * console.log(player.attack); // aumentou
   * ```
   */
  recalculateStats(): void {
    let attack = 5;
    let defense = 0;
    let armor = 0;
    let critChance = 0;
    let critMulti = 1.5;

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

    attack += Math.floor(this.level / 5);

    this.attack = Math.max(1, attack);
    this.defense = Math.max(0, defense);
    this.armor = Math.max(0, armor);
    this.criticalChance = Math.min(100, critChance);
    this.criticalMultiplier = Math.max(1.0, critMulti);

    // Aplica bônus de vocação (HP, mana)
    VocationSystem.applyVocationBonuses(this);
  }

  // =========================
  // SISTEMA DE EXPERIÊNCIA E NÍVEL
  // =========================

  /**
   * Atalho para a única regra de XP do servidor, em ExperienceSystem.
   * Mantém compatibilidade com as chamadas antigas a player.addExperience().
   */
  addExperience(amount: number): void {
    ExperienceSystem.addXp(this, amount);
  }

  // =========================
  // SKILLS
  // =========================

  /**
   * Adiciona progresso a uma skill (delega para SkillSystem).
   *
   * @param skill - Tipo da skill (ex: SkillType.SWORD)
   * @param amount - Quantidade de progresso a adicionar
   * @returns {void}
   *
   * @example
   * ```typescript
   * player.addSkillProgress(SkillType.FISHING, 0.5);
   * ```
   */
  addSkillProgress(skill: SkillType, amount: number): void {
    SkillSystem.addProgress(this, skill, amount);
  }

  // =========================
  // EQUIPAMENTOS
  // =========================

  /**
   * Equipa um item (move do inventário para o slot correspondente).
   *
   * @param itemId - ID completo do item (ex: "equipment/weapon/swords/boneSword")
   * @returns `true` se equipou com sucesso, `false` caso contrário
   *
   * @remarks
   * - Verifica se o item existe e é do tipo "equipment".
   * - Verifica nível mínimo exigido pelo item.
   * - Remove uma unidade do inventário.
   * - Se já houver item no mesmo slot, devolve-o ao inventário.
   * - Recalcula os atributos após equipar.
   *
   * @example
   * ```typescript
   * player.equipItem("equipment/weapon/swords/boneSword");
   * ```
   */
  equipItem(itemId: string): boolean {
    const item = ItemRegistry.get(itemId);
    if (!item || item.type !== "equipment") {
      Logger.warn(`Não é possível equipar ${itemId}: não é um equipamento.`);
      return false;
    }
    const slot = item.slot;
    if (!slot) {
      Logger.warn(`[EQUIP] ❌ ${this.name} tentou equipar ${itemId}, mas não tem slot definido.`);
      return false;
    }

    if (item.levelRequired && this.level < item.levelRequired) {
      Logger.warn(`Nível ${item.levelRequired} necessário para equipar ${item.name}.`);
      return false;
    }

    if (!this.removeItem(itemId, 1)) {
      Logger.warn(`Você não possui ${item.name} para equipar.`);
      return false;
    }

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
   * Remove um item do slot de equipamento e o devolve ao inventário.
   * @param slot - Slot a ser desequipado (ex: EquipmentSlot.HEAD)
   * @returns `true` se o item foi desequipado com sucesso, `false` caso contrário.
   */
  public unequipItem(slot: EquipmentSlot): boolean {
    // Verifica se há um item equipado neste slot
    const itemId = this.equipment.get(slot);
    if (!itemId) {
      // Nada para desequipar
      return false;
    }

    // Remove o item do slot
    this.equipment.delete(slot);

    // Devolve o item ao inventário
    this.addItem(itemId, 1);

    // Recalcula os atributos (attack, defense, armor)
    this.recalculateStats();

    return true;
  }

  // =========================
  // INVENTÁRIO
  // =========================

  /**
   * Verifica se uma quantidade CABE no inventário antes de qualquer mutação.
   * Para moedas, valida a conversão em gold (não ocupam inventário).
   */
  canAddItem(itemId: string, amount: number): boolean {
    if (!isValidItemId(itemId) || !isValidQuantity(amount)) return false;

    if (isCoin(itemId)) {
      const gold = getCoinValue(itemId) * amount;
      return Number.isSafeInteger(gold) && canCreditGold(this.gold, gold);
    }

    const current = this.inventory.get(itemId) ?? 0;
    return Number.isSafeInteger(current) &&
      current >= 0 &&
      Number.isSafeInteger(current + amount);
  }

  /**
   * Adiciona itens ou converte moedas em gold.
   * Retorna false SEM alterar nada quando a entrada é inválida/ultrapassa limites.
   */
  addItem(itemId: string, amount: number): boolean {
    if (!this.canAddItem(itemId, amount)) return false;

    if (isCoin(itemId)) {
      const gold = getCoinValue(itemId) * amount;
      if (!this.addGold(gold)) return false;
      Logger.loot(`${this.name} recebeu ${amount}x ${itemId} (${gold} gold).`);
      return true;
    }

    this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + amount);
    EventSystem.getInstance().emit<ItemPickupEventData>(GameEvent.ITEM_PICKUP, {
      playerId: this.id, playerName: this.name, itemId, amount,
    });
    Logger.loot(`${this.name} recebeu ${amount}x ${itemId}`);
    return true;
  }

  /** Remove apenas quantidades positivas existentes; nunca cria itens por subtração. */
  removeItem(itemId: string, amount: number): boolean {
    if (!this.hasItem(itemId, amount)) return false;

    const remaining = this.inventory.get(itemId)! - amount;
    if (remaining === 0) this.inventory.delete(itemId);
    else this.inventory.set(itemId, remaining);
    return true;
  }

  /** Não considera zero/negativos ou frações como uma quantidade possuída. */
  hasItem(itemId: string, amount: number): boolean {
    if (!isValidItemId(itemId) || !isValidQuantity(amount)) return false;
    const current = this.inventory.get(itemId) ?? 0;
    return Number.isSafeInteger(current) && current >= amount;
  }

  /**
   * Exibe o conteúdo do inventário no log (canal LOOT).
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * player.showInventory(); // Log: 🎒 Inventário: 5x health_potion, 100x gold_coin
   * ```
   */
  showInventory(): void {
    if (this.inventory.size === 0) {
      Logger.loot(`${this.name} não possui nenhum item.`);
      return;
    }
    const itemsList = Array.from(this.inventory.entries())
      .map(([id, qty]) => `${qty}x ${id}`)
      .join(", ");
    Logger.loot(`🎒 Inventário: ${itemsList}`);
  }

  /**
   * Exibe os equipamentos atuais e os atributos derivados (canal SYSTEM).
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * player.showEquipment();
   * // Log: ⚔️ Equipamentos: weapon: bone_sword
   * //       📊 Atributos: Atk=13, Def=0, Armor=0, Crit=2% (1.5x)
   * ```
   */
  showEquipment(): void {
    if (this.equipment.size === 0) {
      Logger.system(`${this.name} não está usando nenhum equipamento.`);
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

  // =========================
  // GERENCIAMENTO DE GOLD
  // =========================

  /** Credita gold válido, respeitando o limite do banco PostgreSQL. */
  addGold(amount: number): boolean {
    if (!isValidQuantity(amount) || !canCreditGold(this.gold, amount)) return false;
    this.gold += amount;
    return true;
  }

  /** Debita gold válido, sem permitir saldos negativos ou quantidades negativas. */
  removeGold(amount: number): boolean {
    if (!isValidQuantity(amount) || !isValidGoldBalance(this.gold) || this.gold < amount)
      return false;
    this.gold -= amount;
    return true;
  }

  // =========================
  // SKILL UTILITIES
  // =========================

  /**
   * Retorna o nível atual de uma skill.
   *
   * @param skill - Tipo da skill
   * @returns Nível da skill (padrão 1 se não encontrada)
   *
   * @example
   * ```typescript
   * const fishingLevel = player.getSkillLevel(SkillType.FISHING);
   * ```
   */
  getSkillLevel(skill: SkillType): number {
    return this.skills.get(skill)?.level ?? 1;
  }

  // =========================
  // IMPLEMENTAÇÃO DOS MÉTODOS ABSTRATOS DE CREATURE
  // =========================

  /**
   * Retorna o HP máximo do jogador.
   *
   * @returns {number} HP máximo
   */
  getMaxHp(): number {
    return this.maxHp;
  }

  /**
   * Retorna a mana máxima do jogador.
   *
   * @returns {number} Mana máxima
   */
  getMaxMana(): number {
    return this.maxMana;
  }
}
