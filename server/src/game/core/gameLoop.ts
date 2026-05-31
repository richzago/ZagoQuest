/**
 * gameLoops.ts
 * Inicia os loops de IA (monstros/NPCs) e renderização ASCII.
 */

import { World } from "../world/world";
import { AsciiRenderer } from "../rendering/asciiRenderer";

export function startGameLoops(world: World, renderer: AsciiRenderer): void {
  // Loop de IA (monstros e NPCs) e limpeza de monstros mortos
  setInterval(() => {
    world.monsters.forEach((monster) => monster.ai.update(monster, world));
    world.npcs.forEach((npc) => npc.ai?.update(npc, world));
    world.cleanupDeadMonsters();
  }, 1500);

  // Loop de renderização ASCII
  setInterval(() => {
    renderer.render(world);
  }, 1000);
}
