import { World } from "./world";
import { Tile } from "./tile";

export class Viewport {
  static getVisibleTiles(world: World, centerX: number, centerY: number, range: number): Tile[] {
    const visibleTiles: Tile[] = [];

    for (let x = centerX - range; x <= centerX + range; x++) {
      for (let y = centerY - range; y <= centerY + range; y++) {
        const tile = world.getTile(x, y);

        if (tile) {
          visibleTiles.push(tile);
        }
      }
    }

    return visibleTiles;
  }
}
