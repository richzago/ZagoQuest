import { Creature } from "./creature";
import { MonsterType } from "../../data/monsters/monsterType";
import { MonsterAI } from "../ai/monsterAi";

export class Monster extends Creature {
  type: MonsterType;
  ai: MonsterAI;
  target?: Creature; // pode ser Player ou outro Creature

  constructor(id: number, type: MonsterType, x: number, y: number, ai: MonsterAI) {
    super(id, type.name, x, y, type.visual?.symbol || "M");
    this.type = type;
    this.ai = ai;
    this.maxHp = type.stats.hp;
    this.hp = this.maxHp;
    // Monstros não têm mana por padrão
    this.maxMana = 0;
    this.mana = 0;
    this.level = (type as any).level || 1;
    this.experience = type.combat.xp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMana(): number {
    return 0;
  }
}
