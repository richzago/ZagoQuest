/**
 * monster.ts
 *
 * Representa uma criatura hostil ou passiva no mundo.
 * Herda de Creature e possui dados vindos do JSON (MonsterType).
 * Seu comportamento é controlado pela classe MonsterAI.
 *
 * @module game/entities/Monster
 */

import { Creature } from "./creature";
import { MonsterAI } from "../ai/monsterAi";
import { MonsterType } from "../../shared/interfaces/monster.interface";

export class Monster extends Creature {
  /** Dados estáticos do monstro (HP, dano, XP, loot, etc.) – carregados do JSON */
  type: MonsterType;

  /** Inteligência artificial que define o comportamento (aggro, perseguição, fuga) */
  ai: MonsterAI;

  /** Alvo atual do monstro (geralmente um jogador, mas pode ser outra criatura) */
  target?: Creature;

  /**
   * Cria um novo monstro.
   *
   * @param id - Identificador único
   * @param type - Dados do monstro (vindos do JSON)
   * @param x - Posição X inicial
   * @param y - Posição Y inicial
   * @param ai - Inteligência artificial do monstro
   *
   * @example
   * ```typescript
   * const ratType = MonsterRegistry.get("animals/lowlevel/rat");
   * const rat = new Monster(100, ratType, 5, 5, new MonsterAI());
   * world.addMonster(rat);
   * ```
   */
  constructor(id: number, type: MonsterType, x: number, y: number, ai: MonsterAI) {
    super(id, type.name, x, y, type.visual?.symbol || "M");
    this.type = type;
    this.ai = ai;
    this.maxHp = type.stats.hp;
    this.hp = this.maxHp;
    this.maxMana = 0;
    this.mana = 0;
    this.level = (type as any).level || 1;
    this.experience = type.combat.xp;
  }

  /**
   * Retorna o HP máximo do monstro.
   *
   * @returns {number} HP máximo
   */
  getMaxHp(): number {
    return this.maxHp;
  }

  /**
   * Retorna a mana máxima do monstro (sempre 0).
   *
   * @returns {number} 0
   */
  getMaxMana(): number {
    return 0;
  }
}
