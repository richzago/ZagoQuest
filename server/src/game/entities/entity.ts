import { World } from "../world/world";

export class Entity {
  id: number;
  name: string;
  symbol: string;

  position: {
    x: number;
    y: number;
  };

  // =========================
  // COOLDOWN SYSTEM
  // =========================

  /**
   * Último ataque realizado (timestamp)
   * usado para controlar attack speed.
   */
  lastAttackTime: number = 0;

  constructor(id: number, name: string, x: number, y: number, symbol?: any) {
    this.id = id;
    this.name = name;
    this.symbol = symbol;

    this.position = {
      x,
      y,
    };
  }

  move(dx: number, dy: number, world: World) {
    const newX = this.position.x + dx;
    const newY = this.position.y + dy;

    const tile = world.getTile(newX, newY);

    if (world.isPositionOccupied(newX, newY, this.id)) {
      return;
    }

    if (!tile) {
      return;
    }

    if (!tile.walkable) {
      return;
    }

    this.position.x = newX;
    this.position.y = newY;
  }
}
