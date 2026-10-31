/**
 * tile.ts
 *
 * Representa um único tile (célula) do mapa.
 * Contém sua posição e se é caminhável (walkable).
 *
 * Futuramente pode armazenar: itens no chão, efeitos especiais, luz, etc.
 *
 * @module game/world/Tile
 */

/**
 * Classe que representa uma célula do mapa.
 */
export class Tile {
  /** Coordenada X no mundo (coluna) */
  x: number;

  /** Coordenada Y no mundo (linha) */
  y: number;

  /** Indica se o tile pode ser pisado por jogadores, monstros, etc. */
  walkable: boolean;

  /** Água autoritativa do Ground/Water Tiled, não inferida da posição Y. */
  isWater = false;

  /**
   * Cria um novo tile.
   *
   * @param x - Posição X (coluna)
   * @param y - Posição Y (linha)
   * @param walkable - Se é caminhável (padrão `true`)
   *
   * @example
   * ```typescript
   * const tile = new Tile(5, 5, false);  // parede
   * const ground = new Tile(10, 10);     // chão, caminhável
   * ```
   */
  constructor(x: number, y: number, walkable: boolean = true) {
    this.x = x;
    this.y = y;
    this.walkable = walkable;
  }
}
