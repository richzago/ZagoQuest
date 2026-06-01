/**
 * monster.ts
 *
 * Representa uma criatura hostil ou passiva no mundo.
 * Herda de Creature e possui dados vindos do JSON (MonsterType).
 * Seu comportamento é controlado pela classe MonsterAI.
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

  constructor(id: number, type: MonsterType, x: number, y: number, ai: MonsterAI) {
    // Chama o construtor da classe base Creature
    // O símbolo padrão é 'M' (pode ser sobrescrito pelo JSON, via type.visual.symbol)
    super(id, type.name, x, y, type.visual?.symbol || "M");

    this.type = type;
    this.ai = ai;

    // Atributos de combate vêm do JSON
    this.maxHp = type.stats.hp;
    this.hp = this.maxHp;

    // Monstros não usam mana (por padrão)
    this.maxMana = 0;
    this.mana = 0;

    // Nível do monstro (opcional no JSON, fallback para 1)
    this.level = (type as any).level || 1;

    // Experiência concedida ao matar (vem do campo combat.xp)
    this.experience = type.combat.xp;
  }

  /**
   * Retorna o HP máximo do monstro.
   * Necessário por ser uma classe abstrata em Creature.
   */
  getMaxHp(): number {
    return this.maxHp;
  }

  /**
   * Retorna a mana máxima do monstro (sempre 0).
   */
  getMaxMana(): number {
    return 0;
  }
}
