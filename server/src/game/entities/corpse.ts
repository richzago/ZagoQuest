import { LootItem } from "../../shared/interfaces/loot.interface";

export class Corpse {
  id: number;
  x: number;
  y: number;
  loot: LootItem[];
  killerId?: number; // opcional, para regras de quem pode lootear

  constructor(id: number, x: number, y: number, loot: LootItem[], killerId?: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.loot = loot;
    this.killerId = killerId;
  }
}
