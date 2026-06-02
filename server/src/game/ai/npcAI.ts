/**
 * npcAi.ts
 *
 * Inteligência artificial para NPCs (não combatentes).
 * Movem-se aleatoriamente dentro de uma área limitada e não atacam.
 *
 * @module game/ai/NpcAI
 */

import { Npc } from "../entities/npc";
import { World } from "../world/World";

/**
 * NPC:
 * - nunca ataca
 * - anda lentamente dentro de um range limitado
 *
 * @class NpcAI
 * @param originX - Posição X central de sua área de movimento
 * @param originY - Posição Y central de sua área de movimento
 * @param radius - Raio (distância de Manhattan) permitido para andar (padrão 2)
 *
 * @example
 * ```typescript
 * // NPC que anda num raio de 3 tiles ao redor de (10, 10)
 * const npcAI = new NpcAI(10, 10, 3);
 * npcAI.update(merchant, world);
 * ```
 */
export class NpcAI {
  constructor(
    private originX: number,
    private originY: number,
    private radius: number = 2,
  ) {}

  /**
   * Atualiza o movimento do NPC a cada tick.
   *
   * @param npc - O NPC a ser controlado
   * @param world - Mundo (para verificar colisões ao mover)
   * @returns {void}
   *
   * @remarks
   * Se o NPC estiver fora de sua área permitida, ele retorna ao centro.
   * Caso contrário, anda em uma direção aleatória (cima, baixo, esquerda, direita).
   *
   * @example
   * // Chamado automaticamente pelo game loop
   * npc.ai.update(npc, world);
   */
  update(npc: Npc, world: World): void {
    const dx = npc.position.x - this.originX;
    const dy = npc.position.y - this.originY;

    // Se saiu da área → volta em direção ao centro
    if (Math.abs(dx) > this.radius || Math.abs(dy) > this.radius) {
      const moveX = this.originX > npc.position.x ? 1 : -1;
      const moveY = this.originY > npc.position.y ? 1 : -1;

      npc.move(moveX, moveY, world);
      return;
    }

    // Movimento aleatório dentro da área permitida
    const moves = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    const move = moves[Math.floor(Math.random() * moves.length)];
    npc.move(move.x, move.y, world);
  }
}
