/**
 * player.ts
 *
 * Classe que representa um jogador no mundo.
 * Herda de Creature e adiciona inventário, equipamentos, habilidades, sistema financeiro e estado de pesca.
 *
 * @module game/entities/Player
 */

import { Creature } from "./creature";
import { generateId } from "../../shared/utils/idUtils";
export interface BagInstanceSave {
  id: string;
  itemId: string;
  items: Record<string, number>;
  children: string[];
}
export interface BagStateSave {
  equippedId: string | null;
  bags: BagInstanceSave[];
  loose?: Record<string, number>;
}

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

  /** Identidades individuais das Bags; Map ativo = inventário visível. */
  bagInstances: Map<string, {
    id: string; itemId: string; items: Map<string, number>; children: string[];
  }> = new Map();
  equippedBagInstanceId: string | null = null;
  /** Janela atual: o equipamento permanece a Bag raiz; navegar não equipa. */
  private viewedBagInstanceId: string | null = null;

  /** Permite quantas Bags distintas couberem, em qualquer profundidade. */
  openNestedBag(itemId: string, instanceId?: string): boolean {
    const parent = this.viewedBag();
    if (!parent || !this.isContainerItem(itemId) ||
        (parent.items.get(itemId) ?? 0) < 1) return false;
    const childId = parent.children.find(id => this.bagInstances.get(id)?.itemId === itemId &&
      (!instanceId || id === instanceId));
    if (!childId) return false;
    const child = this.bagInstances.get(childId);
    if (!child) return false;
    this.viewedBagInstanceId = childId;
    this.inventory = child.items;
    return true;
  }

  /** UUID da janela atualmente aberta, usado no snapshot e pelo servidor. */
  getViewedBagInstanceId(): string | null {
    return this.viewedBag()?.id ?? null;
  }

  /**
   * Transação síncrona entre contêineres do MESMO personagem.
   * Tudo é validado antes de uma única mutação; nunca aceita UUID de terceiros,
   * Bags desconectadas da mochila equipada ou ciclos entre pais e filhos.
   */
  transferBagItem(sourceId: string, destinationId: string, itemId: string,
                  amount: number, instanceId?: string): boolean {
    if (!isValidItemId(itemId) || !isValidQuantity(amount) ||
        sourceId === destinationId || !this.equippedBagInstanceId) return false;
    const accessible = new Set<string>();
    const visit = (id: string) => {
      if (accessible.has(id)) return;
      const bag = this.bagInstances.get(id);
      if (!bag) return;
      accessible.add(id);
      for (const child of bag.children) visit(child);
    };
    visit(this.equippedBagInstanceId);
    if (!accessible.has(sourceId) || !accessible.has(destinationId)) return false;
    const source = this.bagInstances.get(sourceId)!;
    const dest = this.bagInstances.get(destinationId)!;
    const have = source.items.get(itemId) ?? 0;
    if (!Number.isSafeInteger(have) || have < amount) return false;
    let definition;
    try { definition = ItemRegistry.get(itemId); } catch { return false; }
    const movingBag = this.isContainerItem(itemId);
    let movingId: string | undefined;
    if (movingBag) {
      if (amount !== 1 || !instanceId ||
          !source.children.includes(instanceId)) return false;
      const moved = this.bagInstances.get(instanceId);
      if (!moved || moved.itemId !== itemId) return false;
      // Mover para si mesma ou para qualquer descendente seria um ciclo.
      const pending = [instanceId];
      const visited = new Set<string>();
      while (pending.length) {
        const id = pending.pop()!;
        if (id === destinationId) return false;
        if (visited.has(id)) continue;
        visited.add(id);
        pending.push(...(this.bagInstances.get(id)?.children ?? []));
      }
      movingId = instanceId;
    } else if (instanceId) return false;
    let used = 0;
    for (const [id, qty] of dest.items) {
      if (!Number.isSafeInteger(qty) || qty <= 0) return false;
      try { used += ItemRegistry.get(id).stackable ? 1 : qty; }
      catch { used += qty; }
    }
    const extra = definition.stackable && dest.items.has(itemId) ? 0 : 
      definition.stackable ? 1 : amount;
    const limit = ItemRegistry.get(dest.itemId).containerSlots ?? 0;
    if (!Number.isSafeInteger(limit) || used + extra > limit) return false;
    // Conferir validade da contagem antes de qualquer mudança.
    const destPrevious = dest.items.get(itemId) ?? 0;
    if (!Number.isSafeInteger(destPrevious + amount)) return false;

    const newAmount = have - amount;
    if (newAmount === 0) source.items.delete(itemId);
    else source.items.set(itemId,newAmount);
    dest.items.set(itemId,destPrevious+amount);
    if (movingId) {
      source.children.splice(source.children.indexOf(movingId),1);
      dest.children.push(movingId);
    }
    // inventory aponta para o Map da janela; não mudar referência ao transferir.
    // O peso total não muda e, portanto, CAP global também não muda.
    return true;
  }

  closeNestedBag(): boolean {
    const activeId = this.viewedBagInstanceId;
    if (!activeId || activeId === this.equippedBagInstanceId) return false;
    const parent = [...this.bagInstances.values()].find(b => b.children.includes(activeId));
    const parentId = parent?.id ?? this.equippedBagInstanceId;
    const selected = parentId ? this.bagInstances.get(parentId) : undefined;
    if (!selected) return false;
    this.viewedBagInstanceId = selected.id;
    this.inventory = selected.items;
    return true;
  }

  get isViewingNestedBag(): boolean {
    return !!this.viewedBagInstanceId &&
      this.viewedBagInstanceId !== this.equippedBagInstanceId;
  }

  getVisibleBagChildren(): Array<{instanceId: string; itemId: string}> {
    const bag = this.viewedBag();
    if (!bag || this.getContainerCapacity() <= 0) return [];
    return bag.children.flatMap(id => {
      const child = this.bagInstances.get(id);
      return child && (bag.items.get(child.itemId) ?? 0) > 0
        ? [{ instanceId:id, itemId:child.itemId }] : [];
    });
  }

  private viewedBag() {
    return this.viewedBagInstanceId
      ? this.bagInstances.get(this.viewedBagInstanceId) : this.equippedBag();
  }
  /** Itens de saves antigos sem Bag, nunca misturados com Bag largada. */
  private looseItems: Map<string, number> = new Map();

  private createBag(itemId: string, items: Map<string, number> = new Map()) {
    const id = generateId();
    const bag = { id, itemId, items, children: [] as string[] };
    this.bagInstances.set(id, bag);
    return bag;
  }

  private equippedBag() {
    return this.equippedBagInstanceId
      ? this.bagInstances.get(this.equippedBagInstanceId) : undefined;
  }

  /** Inicializa estado C10; saves C9 antigos são migrados uma vez, sem apagar itens. */
  restoreBagState(raw: BagStateSave | null | undefined): void {
    this.bagInstances.clear();
    this.equippedBagInstanceId = null;
    this.viewedBagInstanceId = null;
    if (raw && Array.isArray(raw.bags) && raw.bags.length > 0) {
      for (const row of raw.bags) {
        if (!row || typeof row.id !== "string" ||
            typeof row.itemId !== "string" || !Array.isArray(row.children)) continue;
        const items = new Map<string, number>();
        for (const [id, qty] of Object.entries(row.items ?? {}))
          if (isValidItemId(id) && isValidQuantity(qty)) items.set(id, qty);
        this.bagInstances.set(row.id, {
          id: row.id, itemId: row.itemId, items,
          children: row.children.filter(id => typeof id === "string"),
        });
      }
      const selected = raw.equippedId && this.bagInstances.get(raw.equippedId);
      if (selected && this.equipment.get(EquipmentSlot.BACKPACK) === selected.itemId) {
        this.equippedBagInstanceId = selected.id;
        this.viewedBagInstanceId = selected.id;
        this.inventory = selected.items;
      } else {
        this.equipment.delete(EquipmentSlot.BACKPACK);
        this.looseItems = new Map(Object.entries(raw.loose ?? {}));
        this.inventory = this.looseItems;
      }
      return;
    }
    const equippedId = this.equipment.get(EquipmentSlot.BACKPACK);
    if (equippedId) {
      const original = this.inventory;
      const bag = this.createBag(equippedId, original);
      this.equippedBagInstanceId = bag.id;
      this.viewedBagInstanceId = bag.id;
      // Legacy itemId counts inside an active Bag receive stable child instances.
      for (const [id, qty] of original)
        if (this.isContainerItem(id))
          for (let n=0; n<qty; n++) bag.children.push(this.createBag(id).id);
    } else {
      this.looseItems = this.inventory;
    }
  }

  exportBagState(): BagStateSave {
    return {
      equippedId: this.equippedBagInstanceId,
      bags: [...this.bagInstances.values()].map(b => ({
        id:b.id, itemId:b.itemId, items:Object.fromEntries(b.items),
        children:[...b.children],
      })),
      loose: Object.fromEntries(this.looseItems),
    };
  }

  isContainerItem(itemId: string): boolean {
    try {
      const item = ItemRegistry.get(itemId);
      return item.type === "equipment" && item.slot === EquipmentSlot.BACKPACK &&
        Number.isSafeInteger(item.containerSlots) && (item.containerSlots ?? 0) > 0;
    } catch { return false; }
  }

  /** Registra cada Bag comprada, mesmo com itemId igual. */
  registerPurchasedBags(itemId: string, amount: number): void {
    if (!this.isContainerItem(itemId)) return;
    const holder = this.viewedBag();
    for (let i=0; i<amount; i++) {
      const bag = this.createBag(itemId);
      if (holder) holder.children.push(bag.id);
    }
  }

  /** IDs de cada Bag seguem o item, não o personagem nem seu itemId. */
  private takeContainedBag(itemId: string, instanceId?: string) {
    const holder = this.viewedBag();
    const ids = holder ? holder.children : [...this.bagInstances.keys()]
      .filter(id => id !== this.equippedBagInstanceId);
    const index = ids.findIndex(id => this.bagInstances.get(id)?.itemId === itemId &&
      (!instanceId || id === instanceId));
    if (index < 0) return instanceId ? undefined : this.createBag(itemId);
    const id = ids[index];
    if (holder) holder.children.splice(index, 1);
    return this.bagInstances.get(id)!;
  }

  /**
   * Drop de Bag: move toda árvore para o objeto do chão.
   * Não deixa o inventário da Bag antiga visível na Bag nova.
   */
  detachBagForGround(itemId: string, equipped: boolean, instanceId?: string): BagStateSave | null {
    if (!this.isContainerItem(itemId)) return null;
    if (equipped && this.isViewingNestedBag) return null;
    let root;
    if (equipped) {
      root = this.equippedBag();
      if (!root || root.itemId !== itemId) return null;
      this.equippedBagInstanceId = null;
      this.viewedBagInstanceId = null;
      this.equipment.delete(EquipmentSlot.BACKPACK);
      this.inventory = new Map();
      this.looseItems = this.inventory;
      this.recalculateStats();
    } else {
      if (!this.hasItem(itemId, 1)) return null;
      root = this.takeContainedBag(itemId, instanceId);
      if (!root) return null; // UUID estranho NÃO pode consumir outra Bag.
      if (!this.removeItem(itemId, 1)) {
        const parent = this.viewedBag();
        if (parent && !parent.children.includes(root.id))
          parent.children.push(root.id);
        return null;
      }
    }
    if (!root) return null;
    const bags: BagInstanceSave[] = [];
    const walk = (id: string) => {
      const bag = this.bagInstances.get(id);
      if (!bag) return;
      bags.push({id, itemId:bag.itemId,
        items:Object.fromEntries(bag.items),children:[...bag.children]});
      for (const child of bag.children) walk(child);
      this.bagInstances.delete(id);
    };
    walk(root.id);
    return { equippedId:root.id, bags };
  }

  /** Pickup de Bag preserva UUID/filhos e valida peso integral ANTES de mutar. */
  attachGroundBag(itemId: string, state: BagStateSave | undefined, autoequip: boolean): boolean {
    if (!this.isContainerItem(itemId)) return false;
    const incoming = state?.bags?.length ? state.bags : [{
      id:generateId(), itemId, items:{}, children:[],
    }];
    const rootId = state?.equippedId ?? incoming[0].id;
    const rootRow = incoming.find(row => row.id === rootId);
    if (!rootRow || rootRow.itemId !== itemId ||
        incoming.some(row => this.bagInstances.has(row.id)) ||
        new Set(incoming.map(row => row.id)).size !== incoming.length) return false;

    const ids = new Set(incoming.map(row => row.id));
    const visitedChildren = new Set<string>();
    let nestedWeight = 0;
    for (const row of incoming) {
      if (!this.isContainerItem(row.itemId) || !Array.isArray(row.children) ||
          !row.items || typeof row.items !== "object") return false;
      const childCounts = new Map<string, number>();
      for (const childId of row.children) {
        const child = incoming.find(b => b.id === childId);
        if (!ids.has(childId) || !child || childId === rootId ||
            visitedChildren.has(childId)) return false;
        visitedChildren.add(childId);
        childCounts.set(child.itemId, (childCounts.get(child.itemId) ?? 0) + 1);
      }
      if ([...childCounts].some(([id, count]) => (row.items[id] ?? 0) < count))
        return false;
      for (const [id, qty] of Object.entries(row.items)) {
        if (!isValidItemId(id) || !isValidQuantity(qty)) return false;
        nestedWeight += Player.itemWeight(id) * qty;
      }
    }
    if (visitedChildren.size !== incoming.length - 1 ||
        incoming.some(row => row.id !== rootId && !visitedChildren.has(row.id)))
      return false;
    // Uma Bag ocupa UM slot, mas seu conteúdo completo pesa no CAP.
    if (!Number.isFinite(nestedWeight) ||
        this.getCarriedWeight() + Player.itemWeight(itemId) + nestedWeight >
          this.getMaxCarryWeight() + 1e-6) return false;
    const parent = this.viewedBag();
    if (!autoequip && (!parent || !this.canCollectItems([{itemId,amount:1}])))
      return false;
    if (autoequip && this.equipment.has(EquipmentSlot.BACKPACK)) return false;

    // Creditar ao pai antes de ligar a árvore: evita double-count em canAddItem.
    if (!autoequip && !this.addItem(itemId, 1)) return false;
    for (const row of incoming)
      this.bagInstances.set(row.id, {id:row.id,itemId:row.itemId,
        items:new Map(Object.entries(row.items)),children:[...row.children]});
    const root = this.bagInstances.get(rootId)!;
    if (autoequip) {
      this.equipment.set(EquipmentSlot.BACKPACK, itemId);
      this.equippedBagInstanceId = rootId;
      this.viewedBagInstanceId = rootId;
      this.inventory = root.items;
      this.recalculateStats();
    } else {
      parent!.children.push(rootId);
    }
    return true;
  }

  /** Venda de Bag cheia é proibida: nunca apagar seus itens por venda. */
  canSellBag(itemId: string, amount: number): boolean {
    if (!this.isContainerItem(itemId)) return true;
    const holder = this.equippedBag();
    const matching = holder
      ? holder.children.map(id => this.bagInstances.get(id))
          .filter(b => b?.itemId === itemId)
      : [...this.bagInstances.values()]
          .filter(b => b.id !== this.equippedBagInstanceId && b.itemId === itemId);
    return matching.length >= amount &&
      matching.slice(0,amount).every(b => b!.items.size === 0 && b!.children.length === 0);
  }

  releaseSoldBags(itemId: string, amount: number): void {
    if (!this.isContainerItem(itemId)) return;
    const holder = this.equippedBag();
    for (let i=0; i<amount; i++) {
      if (!holder) {
        // Sem Bag equipada, somente uma Bag vazia no inventário solto
        // pode ser vendida; não apagar conteúdo de outras instâncias.
        const entry = [...this.bagInstances.values()]
          .find(b => b.id !== this.equippedBagInstanceId &&
            b.itemId === itemId && b.items.size === 0 && b.children.length === 0);
        if (!entry) return;
        this.bagInstances.delete(entry.id);
        continue;
      }
      const idx = holder.children.findIndex(id=>this.bagInstances.get(id)?.itemId === itemId);
      if (idx<0) return;
      this.bagInstances.delete(holder.children[idx]);
      holder.children.splice(idx,1);
    }
  }

  /** Mapa de equipamentos: slot → itemId */
  equipment: Map<EquipmentSlot, string> = new Map();

  /** Mapa de habilidades: SkillType → { level, progress } */
  skills: Map<SkillType, SkillState> = new Map();

  /** Dinheiro em mãos (gold) */
  gold: number = 0;

  /** Dinheiro depositado no banco */
  bankGold: number = 0;

  /** Taxa reservada para rollback de uma operação REST ainda pendente. */
  private reservedGold = 0;

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
  equipItem(itemId: string, instanceId?: string): boolean {
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

    if (slot === EquipmentSlot.BACKPACK && this.isContainerItem(itemId)) {
      // Não criar ciclo ao equipar uma Bag enquanto se navega dentro dela.
      if (this.isViewingNestedBag || !this.hasItem(itemId, 1)) return false;
      const oldBag = this.equippedBag();
      // Sem Bag equipada, conteúdo legado no mapa não pode sumir na migração.
      const target = this.takeContainedBag(itemId, instanceId);
      if (!target) return false; // UUID não é filho da Bag atual.
      const targetCapacity = item.containerSlots ?? 0;
      const used = [...target.items].reduce((sum,[id,qty]) => {
        try { return sum + (ItemRegistry.get(id).stackable ? 1 : qty); }
        catch { return sum+qty; }
      },0);
      if (oldBag && used + 1 > targetCapacity) {
        if (this.bagInstances.has(target.id) && oldBag)
          oldBag.children.push(target.id);
        return false;
      }
      this.removeItem(itemId,1);
      if (oldBag) {
        target.items.set(oldBag.itemId,(target.items.get(oldBag.itemId)??0)+1);
        target.children.push(oldBag.id);
      } else {
        // Recolher uma Bag do chão cria conteúdo vazio; só saves legados
        // ainda sem estrutura têm itens soltos para migrar.
        for(const [id,qty] of this.inventory)
          target.items.set(id,(target.items.get(id)??0)+qty);
        target.children.push(...[...this.bagInstances.values()]
          .filter(b=>b.id!==target.id).map(b=>b.id)
          .filter(id=>!target.children.includes(id)));
        this.looseItems = new Map();
      }
      this.equippedBagInstanceId = target.id;
      this.viewedBagInstanceId = target.id;
      this.inventory = target.items;
      this.equipment.set(slot,itemId);
      this.recalculateStats();
      return true;
    }
    if (!this.removeItem(itemId, 1)) {
      Logger.warn(`Você não possui ${item.name} para equipar.`);
      return false;
    }

    const currentItemId = this.equipment.get(slot);
    // Transferência de peso, não pickup: remover do equipamento antes
    // de adicionar ao inventário evita contar o item antigo duas vezes.
    if (currentItemId) this.equipment.delete(slot);
    if (currentItemId && !this.addItem(currentItemId, 1)) {
      this.equipment.set(slot, currentItemId);
      this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + 1);
      return false;
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

    if (slot === EquipmentSlot.BACKPACK) {
      const old = this.equippedBag();
      if (!old) return false;
      this.equippedBagInstanceId = null;
      this.viewedBagInstanceId = null;
      this.equipment.delete(slot);
      this.looseItems = new Map([[itemId,1]]);
      this.inventory = this.looseItems;
      this.recalculateStats();
      return true;
    }
    // É transferência do próprio equipamento, não peso extra: primeiro
    // remove do slot, depois adiciona no inventário, revertendo se falhar.
    this.equipment.delete(slot);
    if (!this.canAddItem(itemId, 1) || !this.addItem(itemId, 1)) {
      this.equipment.set(slot, itemId);
      return false;
    }

    // Recalcula os atributos (attack, defense, armor)
    this.recalculateStats();

    return true;
  }

  // =========================
  // BAG/BACKPACK — autoridade exclusiva do servidor
  // =========================

  /** Capacidade da mochila EQUIPADA. Itens legados permanecem no save se ela sair. */
  getContainerCapacity(): number {
    // Um view stale nunca pode conceder capacidade se nenhum slot estiver
    // equipado (logout, reload de save antigo, ou estado legado).
    const equipped = this.equipment.get(EquipmentSlot.BACKPACK);
    if (!equipped) return 0;
    const bagId = this.viewedBag()?.itemId ?? equipped;
    try {
      const bag = ItemRegistry.get(bagId);
      return bag.type === "equipment" && bag.slot === EquipmentSlot.BACKPACK &&
        Number.isSafeInteger(bag.containerSlots) && (bag.containerSlots ?? 0) > 0
          ? bag.containerSlots! : 0;
    } catch { return 0; }
  }

  getContainerItemId(): string | null {
    return this.getContainerCapacity() > 0
      ? this.viewedBag()?.itemId ??
        this.equipment.get(EquipmentSlot.BACKPACK) ?? null : null;
  }

  /** Cada item stackable ocupa 1 slot; item não-stackable ocupa 1 por unidade. */
  getContainerSlotsUsed(): number {
    let total = 0;
    for (const [id, amount] of this.inventory) {
      if (!Number.isSafeInteger(amount) || amount <= 0) continue;
      try {
        total += ItemRegistry.get(id).stackable ? 1 : amount;
      } catch {
        total += amount; // saves legados: conservador, sem excluir itens
      }
    }
    return total;
  }

  /** C14: peso de cada unidade, configurável no JSON; padrão 1 oz para saves antigos. */
  static itemWeight(itemId: string): number {
    if (isCoin(itemId)) return 0; // Moedas recolhidas são convertidas para gold.
    try {
      const value = ItemRegistry.get(itemId).weight;
      return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value : 1;
    } catch { return 1; }
  }

  getMaxCarryWeight(): number {
    // CAP base 400 oz +10 oz por level. Não depende de entrada do Unity.
    return 400 + Math.max(0, this.level - 1) * 10;
  }

  getCarriedWeight(): number {
    let weight = 0;
    for (const id of this.equipment.values()) weight += Player.itemWeight(id);
    const visited = new Set<string>();
    const traverse = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id); // Bloqueia ciclos em saves antigos sem travar a rede.
      const bag = this.bagInstances.get(id);
      if (!bag) return;
      for (const [itemId, amount] of bag.items)
        if (Number.isSafeInteger(amount) && amount > 0)
          weight += Player.itemWeight(itemId) * amount;
      for (const childId of bag.children) traverse(childId);
    };
    if (this.equippedBagInstanceId) traverse(this.equippedBagInstanceId);
    else for (const [itemId, amount] of this.inventory)
      if (Number.isSafeInteger(amount) && amount > 0)
        weight += Player.itemWeight(itemId) * amount;
    return weight;
  }

  getRemainingCap(): number {
    return Math.max(0, this.getMaxCarryWeight() - this.getCarriedWeight());
  }

  /** Exclusivo das transferências chão/cadáver para a Bag ativa. */
  canCollectItems(items: ReadonlyArray<{itemId: string; amount: number}>): boolean {
    const capacity = this.getContainerCapacity();
    if (capacity <= 0 || !this.canAddItems(items)) return false;
    let used = this.getContainerSlotsUsed();
    const pending = new Map<string, number>();
    for (const {itemId, amount} of items) {
      // Moedas também requerem Bag, embora sejam convertidas em gold.
      if (isCoin(itemId)) continue;
      const old = pending.get(itemId) ?? 0;
      pending.set(itemId, old + amount);
      if (!Number.isSafeInteger(old + amount)) return false;
    }
    for (const [id, qty] of pending) {
      try {
        const item = ItemRegistry.get(id);
        if (item.stackable) {
          if (!this.inventory.has(id)) used += 1;
        } else used += qty;
      } catch { used += qty; }
      if (!Number.isSafeInteger(used) || used > capacity) return false;
    }
    return used <= capacity;
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
      return Number.isSafeInteger(gold) && this.canReceiveGold(gold);
    }

    const current = this.inventory.get(itemId) ?? 0;
    const afterWeight = this.getCarriedWeight() + Player.itemWeight(itemId) * amount;
    return Number.isSafeInteger(current) &&
      current >= 0 &&
      Number.isSafeInteger(current + amount) &&
      Number.isFinite(afterWeight) && afterWeight <= this.getMaxCarryWeight() + 1e-6;
  }

  /**
   * Valida um lote de loot ANTES de coletá-lo; considera itens repetidos
   * e moedas diferentes que serão convertidas para a mesma carteira.
   */
  canAddItems(items: ReadonlyArray<{ itemId: string; amount: number }>): boolean {
    const pending = new Map<string, number>();
    let goldToAdd = 0;

    for (const { itemId, amount } of items) {
      if (!isValidItemId(itemId) || !isValidQuantity(amount)) return false;
      if (isCoin(itemId)) {
        const coinGold = amount * getCoinValue(itemId);
        goldToAdd += coinGold;
        if (!Number.isSafeInteger(goldToAdd)) return false;
      } else {
        const total = (pending.get(itemId) ?? 0) + amount;
        if (!Number.isSafeInteger(total)) return false;
        pending.set(itemId, total);
      }
    }

    if (!this.canReceiveGold(goldToAdd)) return false;
    let addedWeight = 0;
    for (const [itemId, amount] of pending)
      addedWeight += Player.itemWeight(itemId) * amount;
    if (!Number.isFinite(addedWeight) ||
        this.getCarriedWeight() + addedWeight > this.getMaxCarryWeight() + 1e-6)
      return false;
    for (const [itemId, amount] of pending) {
      const current = this.inventory.get(itemId) ?? 0;
      if (!Number.isSafeInteger(current) || current < 0 ||
          !Number.isSafeInteger(current + amount)) return false;
    }
    return true;
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

  /**
   * Gold reservado já saiu da carteira, mas seu valor precisa ficar disponível
   * para devolução se o PostgreSQL fizer ROLLBACK.
   */
  canReceiveGold(amount: number): boolean {
    return canCreditGold(this.gold + this.reservedGold, amount);
  }

  /** Credita sem consumir o espaço reservado para eventual rollback. */
  addGold(amount: number): boolean {
    if (!isValidQuantity(amount) || !this.canReceiveGold(amount)) return false;
    this.gold += amount;
    return true;
  }

  /** Reserva a taxa antes da gravação assíncrona na transação. */
  reserveGold(amount: number): boolean {
    if (!this.removeGold(amount)) return false;
    this.reservedGold += amount;
    return true;
  }

  /** Confirma o débito (já descontado) após COMMIT. */
  commitReservedGold(amount: number): void {
    if (!isValidQuantity(amount) || this.reservedGold < amount)
      throw new Error("Reserva de gold inconsistente.");
    this.reservedGold -= amount;
  }

  /** Restaura a carteira após ROLLBACK. */
  rollbackReservedGold(amount: number): void {
    if (!isValidQuantity(amount) || this.reservedGold < amount)
      throw new Error("Reserva de gold inconsistente.");
    this.reservedGold -= amount;
    this.gold += amount;
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
