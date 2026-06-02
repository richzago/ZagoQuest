/**
 * viewport.ts
 *
 * Utilitário para calcular quais tiles estão visíveis em uma área retangular ao redor de um centro.
 * Usado pelo renderizador ASCII para desenhar apenas uma porção do mundo.
 *
 * O conceito de viewport é essencial para performance e jogabilidade (câmera que acompanha o jogador).
 *
 * Nota: No `AsciiRenderer` já implementamos a lógica de viewport diretamente. Este arquivo é um helper
 * reutilizável (não usado atualmente, mas mantido para referência).
 *
 * @module game/world/Viewport
 */

import { World } from "./World";
import { Tile } from "./tile";

/**
 * Classe estática que fornece métodos para cálculo de viewport.
 */
export class Viewport {
  /**
   * Retorna um array de todos os tiles dentro de um quadrado de lado `(2*range+1)` centrado em `(centerX, centerY)`.
   *
   * @param world - Mundo que contém os tiles
   * @param centerX - Coordenada X central (geralmente a posição do jogador)
   * @param centerY - Coordenada Y central
   * @param range - Raio (ex: `range = 4` → janela 9×9)
   * @returns Lista de tiles visíveis (apenas os que existem dentro dos limites do mundo)
   *
   * @remarks
   * A função percorre todas as coordenadas no retângulo `[centerX - range, centerX + range]` ×
   * `[centerY - range, centerY + range]` e adiciona os tiles que existem (não `undefined`).
   * Tiles fora dos limites do mundo são ignorados.
   *
   * @example
   * ```typescript
   * // Obter todos os tiles num raio de 4 ao redor do jogador
   * const player = world.players[0];
   * const visibleTiles = Viewport.getVisibleTiles(world, player.position.x, player.position.y, 4);
   * console.log(`Existem ${visibleTiles.length} tiles visíveis.`);
   * ```
   */
  static getVisibleTiles(world: World, centerX: number, centerY: number, range: number): Tile[] {
    const visibleTiles: Tile[] = [];

    // Itera sobre a área quadrada
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
