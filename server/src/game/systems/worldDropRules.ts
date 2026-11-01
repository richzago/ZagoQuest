/**
 * C14 — alcance de arremesso. A câmera do Unity não é evidência confiável:
 * o servidor impõe uma janela máxima fixa de 17 x 13 tiles (8/6 do jogador),
 * rejeita águas/paredes (Tile.walkable=false) e linha de visão obstruída.
 * No client, a pixelRect ainda precisa conter o ponto solicitado.
 */
import type { World } from "../world/World";
import type { Player } from "../entities/player";

export const DROP_VIEW_RADIUS_X = 8;
export const DROP_VIEW_RADIUS_Y = 6;

export function canDropOnWorldTile(world: World, player: Player, x: number, y: number): boolean {
  if (!world.isWithinBounds(x, y)) return false;
  const sx = Math.floor(player.position.x), sy = Math.floor(player.position.y);
  if (!world.isWithinBounds(sx, sy) ||
      Math.abs(x - sx) > DROP_VIEW_RADIUS_X ||
      Math.abs(y - sy) > DROP_VIEW_RADIUS_Y) return false;
  if (!world.isPositionWalkable(x, y, player.id)) return false;

  // Supercover ray: todos os tiles intermediários devem ser caminháveis.
  // Item não atravessa parede, obstáculo ou água. A posição inicial é livre.
  let cx = sx, cy = sy;
  const dx = x - sx, dy = y - sy;
  const nx = Math.abs(dx), ny = Math.abs(dy);
  const signX = Math.sign(dx), signY = Math.sign(dy);
  let ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (decision === 0) {
      // Atravessar uma quina diagonal não contorna dois tiles bloqueados.
      if (world.getTile(cx + signX, cy)?.walkable === false &&
          world.getTile(cx, cy + signY)?.walkable === false) return false;
      cx += signX; cy += signY; ix++; iy++;
    } else if (decision < 0) { cx += signX; ix++; }
    else { cy += signY; iy++; }
    if (!world.getTile(cx, cy)?.walkable) return false;
  }
  return true;
}
