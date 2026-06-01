/**
 * gameLoop.ts
 * Inicia os loops de IA (monstros/NPCs) e renderização ASCII.
 * Permite pausar e retomar o loop de renderização (usado pelo chat).
 */

import { World } from "../world/world";
import { AsciiRenderer } from "../rendering/asciiRenderer";

let renderInterval: NodeJS.Timeout | null = null;
let currentRenderer: AsciiRenderer | null = null;
let currentWorld: World | null = null;

function startRenderLoop(): void {
  if (renderInterval) return;
  if (!currentRenderer || !currentWorld) return;
  renderInterval = setInterval(() => {
    currentRenderer!.render(currentWorld!);
  }, 1000);
}

export function startGameLoops(world: World, renderer: AsciiRenderer): void {
  currentRenderer = renderer;
  currentWorld = world;

  setInterval(() => {
    world.monsters.forEach((m) => m.ai.update(m, world));
    world.npcs.forEach((n) => n.ai?.update(n, world));
    world.cleanupDeadMonsters();
  }, 1500);

  startRenderLoop();
}

export function pauseRenderLoop(): void {
  if (renderInterval) {
    clearInterval(renderInterval);
    renderInterval = null;
  }
}

export function resumeRenderLoop(): void {
  if (!renderInterval && currentRenderer && currentWorld) {
    startRenderLoop();
  }
}
