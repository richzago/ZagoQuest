import { CombatStats } from "../../shared/interfaces/combat.interface";
import { Damageable } from "../../shared/interfaces/damageable.interface";
import { Entity } from "./entity";
/**
 * Classe base abstrata para todas as criaturas (Player, Monster, Npc).
 * Centraliza atributos comuns: HP, Mana, Level, Experience e atributos de combate.
 */
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

  constructor(id: number, name: string, x: number, y: number, symbol: string) {
    super(id, name, x, y, symbol);

    // Valores padrão (serão sobrescritos nas subclasses)
    this.hp = 100;
    this.maxHp = 100;
    this.mana = 0;
    this.maxMana = 0;
    this.level = 1;
    this.experience = 0;

    // Atributos de combate iniciais (serão recalculados para Player via equipamentos)
    this.attack = 5;
    this.defense = 0;
    this.armor = 0;
    this.criticalChance = 0;
    this.criticalMultiplier = 1.5;
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
