import { Npc } from "../entities/npc";
import { World } from "../world/world";

/**
 * NPC:
 * - nunca ataca
 * - anda lentamente dentro de um range limitado
 */
export class NpcAI {
  constructor(
    private originX: number,
    private originY: number,
    private radius: number = 2,
  ) {}

  update(npc: Npc, world: World): void {
    const dx = npc.position.x - this.originX;
    const dy = npc.position.y - this.originY;

    // se saiu da área → volta
    if (Math.abs(dx) > this.radius || Math.abs(dy) > this.radius) {
      const moveX = this.originX > npc.position.x ? 1 : -1;
      const moveY = this.originY > npc.position.y ? 1 : -1;

      npc.move(moveX, moveY, world);
      return;
    }

    // movimento aleatório leve dentro da área
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
