/**
 * gameLoop.ts
 *
 * Inicia os loops de IA (monstros/NPCs) e renderização ASCII.
 * Permite pausar e retomar o loop de renderização (usado pelo chat).
 *
 * @module game/core/gameLoop
 */

import { World } from "../world/World";
import { AsciiRenderer } from "../rendering/asciiRenderer";

let renderInterval: NodeJS.Timeout | null = null;
let currentRenderer: AsciiRenderer | null = null;
let currentWorld: World | null = null;

/**
 * Inicia o loop de renderização (se não estiver rodando).
 * @private
 */
function startRenderLoop(): void {
  if (renderInterval) return;
  if (!currentRenderer || !currentWorld) return;
  renderInterval = setInterval(() => {
    currentRenderer!.render(currentWorld!);
  }, 1000);
}

/**
 * Inicia os loops do jogo:
 * - Loop de IA (monstros e NPCs) – executa a cada 1.5s e nunca é pausado.
 * - Loop de renderização (ASCII) – pode ser pausado pelo chat.
 *
 * @param world - Mundo do jogo (contém entidades, tiles, etc.)
 * @param renderer - Renderizador ASCII
 * @returns {void}
 *
 * @example
 * ```typescript
 * startGameLoops(world, asciiRenderer);
 * ```
 */
export function startGameLoops(world: World, renderer: AsciiRenderer): void {
  currentRenderer = renderer;
  currentWorld = world;

  // Loop de IA (monstros e NPCs) – nunca pausa
  setInterval(() => {
    world.monsters.forEach((m) => m.ai.update(m, world));
    world.npcs.forEach((n) => n.ai?.update(n, world));
    world.cleanupDeadMonsters();
  }, 1500);

  startRenderLoop();
}

/**
 * Pausa o loop de renderização (útil durante o modo chat).
 * O loop de IA continua rodando normalmente.
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * pauseRenderLoop(); // chamado quando o chat é ativado
 * ```
 */
export function pauseRenderLoop(): void {
  if (renderInterval) {
    clearInterval(renderInterval);
    renderInterval = null;
  }
}

/**
 * Retoma o loop de renderização após ter sido pausado.
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * resumeRenderLoop(); // chamado quando o chat é encerrado
 * ```
 */
export function resumeRenderLoop(): void {
  if (!renderInterval && currentRenderer && currentWorld) {
    startRenderLoop();
  }
}
