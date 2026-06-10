/**
 * creature.ts
 *
 * Classe base abstrata para todas as criaturas (Player, Monster, Npc).
 * Centraliza atributos comuns: HP, Mana, Level, Experience e atributos de combate.
 *
 * @module game/entities/Creature
 */

import { CombatStats } from "../../shared/interfaces/combat.interface";
import { Damageable } from "../../shared/interfaces/damageable.interface";
import { ConditionManager } from "../combat/conditions/conditionManager";
import { CooldownManager } from "../combat/cooldownManager";
import { Entity } from "./entity";

export abstract class Creature extends Entity implements Damageable, CombatStats {
  // =========================
  // ATRIBUTOS DE VIDA E MANA
  // =========================
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;

  // =========================
  // PROGRESSÃO
  // =========================
  level: number;
  experience: number; // ← note: é `experience`, não `xp`

  // =========================
  // GERENCIAMENTO DE CONDIÇÕES E COOLDOWNS
  // =========================
  public conditionManager: ConditionManager;
  public cooldownManager: CooldownManager;

  // Getter/Setter para compatibilidade com código antigo que usa `player.xp`
  get xp(): number {
    return this.experience;
  }
  set xp(value: number) {
    this.experience = value;
  }

  // =========================
  // ATRIBUTOS DE COMBATE (CombatStats)
  // =========================
  attack: number;
  defense: number;
  armor: number;
  criticalChance: number;
  criticalMultiplier: number;

  /**
   * Cria uma nova criatura.
   *
   * @param id - Identificador único
   * @param name - Nome da criatura
   * @param x - Posição X inicial
   * @param y - Posição Y inicial
   * @param symbol - Símbolo ASCII para renderização
   *
   * @remarks
   * Valores padrão:
   * - HP: 100
   * - Mana: 0
   * - Level: 1
   * - Experience: 0
   * - Attack: 5
   * - Defense: 0
   * - Armor: 0
   * - CriticalChance: 0
   * - CriticalMultiplier: 1.5
   */
  constructor(id: string, name: string, x: number, y: number) {
    super(id, name, x, y);

    this.hp = 100;
    this.maxHp = 100;
    this.mana = 0;
    this.maxMana = 0;
    this.level = 1;
    this.experience = 0;
    this.attack = 5;
    this.defense = 0;
    this.armor = 0;
    this.criticalChance = 0;
    this.criticalMultiplier = 1.5;
    this.conditionManager = new ConditionManager(this);
    this.cooldownManager = new CooldownManager();
  }

  // =========================
  // MÉTODOS DE UTILIDADE
  // =========================
  isAlive(): boolean {
    return this.hp > 0;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  restoreMana(amount: number): void {
    if (this.maxMana > 0) {
      this.mana = Math.min(this.maxMana, this.mana + amount);
    }
  }

  addExperience(amount: number): void {
    this.experience += amount;
  }

  // =========================
  // MÉTODOS ABSTRATOS (devem ser implementados pelas subclasses)
  // =========================
  abstract getMaxHp(): number;
  abstract getMaxMana(): number;
}
