import { Creature } from "./creature";
import { NpcAI } from "../ai/npcAI";
import { ShopItem } from "../../shared/interfaces/npcShop.interface";
import { NpcType } from "../../shared/types/npc.type";


export class Npc extends Creature {
  message: string;
  ai?: NpcAI;
  npcType: NpcType;
  shopItems?: ShopItem[]; // apenas para merchant
  bankBalance?: number; // apenas para banker (se o banco for global, não precisa aqui)

  constructor(
    id: number,
    name: string,
    x: number,
    y: number,
    message: string,
    npcType: NpcType = "quest",
  ) {
    super(id, name, x, y, "N");
    this.message = message;
    this.npcType = npcType;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.maxMana = 0;
    this.mana = 0;
    this.level = 1;
    this.experience = 0;
  }

  getMaxHp(): number {
    return this.maxHp;
  }
  getMaxMana(): number {
    return 0;
  }
}
