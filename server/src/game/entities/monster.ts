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
  type: MonsterType;
  ai: MonsterAI;
  target?: Creature;

  // 🔥 NOVOS CAMPOS PARA RESPAWN
  spawnX: number;
  spawnY: number;
  wanderRadius: number = 3;
  respawnTime: number = 10000; // padrão 10s

  constructor(
    id: string,
    type: MonsterType,
    x: number,
    y: number,
    ai: MonsterAI,
    wanderRadius: number = 3,
    respawnTime: number = 10000, // ← parâmetro adicional
  ) {
    super(id, type.name, x, y);
    this.type = type;
    this.ai = ai;
    this.maxHp = type.stats.hp;
    this.hp = this.maxHp;
    this.maxMana = 0;
    this.mana = 0;
    this.level = (type as any).level || 1;
    this.experience = type.combat.xp;

    // define o ponto de origem e o raio de wander
    this.spawnX = x;
    this.spawnY = y;
    this.wanderRadius = wanderRadius;
    this.respawnTime = respawnTime;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMana(): number {
    return 0;
  }
}
