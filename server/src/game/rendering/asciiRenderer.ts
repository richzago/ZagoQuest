import { World } from "../world/world";

import { Player } from "../entities/player";
import { Monster } from "../entities/monster";
import { Npc } from "../entities/npc";

export class AsciiRenderer {
  render(world: World) {
    const VIEW_WIDTH = 9;
    const VIEW_HEIGHT = 7;

    const player = world.players[0];

    if (!player) return;

    const startX = player.position.x - Math.floor(VIEW_WIDTH / 2);

    const startY = player.position.y - Math.floor(VIEW_HEIGHT / 2);

    let output = "";

    for (let y = 0; y < VIEW_HEIGHT; y++) {
      for (let x = 0; x < VIEW_WIDTH; x++) {
        const worldX = startX + x;
        const worldY = startY + y;

        // =========================
        // ENTITY RENDER
        // =========================

        const entity = world.getEntityAt(worldX, worldY);

        if (entity) {
          // Player
          if (entity instanceof Player) {
            output += "P";
          }

          // Monster
          else if (entity instanceof Monster) {
            output += "M";
          }

          // NPC
          else if (entity instanceof Npc) {
            output += "N";
          }

          // Fallback
          else {
            output += "?";
          }

          continue;
        }

        // =========================
        // TILE RENDER
        // =========================

        const tile = world.getTile(worldX, worldY);

        if (!tile) {
          output += " ";
          continue;
        }

        output += tile.walkable ? "." : "#";
      }

      output += "\n";
    }

    console.clear();
    console.log(output);
  }
}
