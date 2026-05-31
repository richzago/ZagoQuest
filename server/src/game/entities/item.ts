import { ItemType } from "../../data/items/itemTypes";

export class ItemEntity {
  id: number;
  type: ItemType;
  amount: number;
  position: { x: number; y: number };

  constructor(id: number, type: ItemType, amount: number, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.amount = amount;
    this.position = { x, y };
  }
}
