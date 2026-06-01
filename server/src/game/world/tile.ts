/**
 * tile.ts
 *
 * Representa um único tile (célula) do mapa.
 * Contém sua posição e se é caminhável (walkable).
 *
 * Futuramente pode armazenar: itens no chão, efeitos especiais, luz, etc.
 */

export class Tile {
  x: number; // Coordenada X no mundo
  y: number; // Coordenada Y no mundo
  walkable: boolean; // true: jogador/monstro pode pisar; false: bloqueado (parede, água, etc.)

  constructor(x: number, y: number, walkable: boolean = true) {
    this.x = x;
    this.y = y;
    this.walkable = walkable;
  }
}
