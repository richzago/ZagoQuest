export class Tile {
  x: number;
  y: number;

  walkable: boolean;

  constructor(x: number, y: number, walkable: boolean = true) {
    this.x = x;
    this.y = y;

    this.walkable = walkable;
  }
}
