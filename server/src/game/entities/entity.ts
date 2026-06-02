/**
 * entity.ts
 *
 * Classe base para qualquer objeto que existe no mundo (Player, Monster, Npc, etc.).
 * Contém identificador, nome, posição, símbolo e sistema de cooldown para ataques.
 *
 * @module game/entities/Entity
 */

import { World } from "../world/World";

export class Entity {
  id: number;
  name: string;
  symbol: string;
  position: { x: number; y: number };
  lastAttackTime: number = 0;

  /**
   * Cria uma nova entidade.
   *
   * @param id - Identificador único
   * @param name - Nome da entidade
   * @param x - Posição X inicial
   * @param y - Posição Y inicial
   * @param symbol - Símbolo ASCII para renderização
   */
  constructor(id: number, name: string, x: number, y: number, symbol?: any) {
    this.id = id;
    this.name = name;
    this.symbol = symbol;
    this.position = { x, y };
  }

  /**
   * Move a entidade para uma nova posição, respeitando colisões e limites do mundo.
   *
   * @param dx - Deslocamento no eixo X (-1, 0, 1)
   * @param dy - Deslocamento no eixo Y (-1, 0, 1)
   * @param world - Referência ao mundo (para verificar tiles e ocupação)
   * @returns {void}
   *
   * @example
   * ```typescript
   * player.move(0, -1, world); // move para cima
   * ```
   */
  move(dx: number, dy: number, world: World) {
    const newX = this.position.x + dx;
    const newY = this.position.y + dy;
    const tile = world.getTile(newX, newY);

    if (world.isPositionOccupied(newX, newY, this.id)) return;
    if (!tile) return;
    if (!tile.walkable) return;

    this.position.x = newX;
    this.position.y = newY;
  }
}
