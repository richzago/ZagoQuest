/**
 * Posição de sessão: o DB preserva onde o jogador parou; Tiled define onde
 * ele nasce e o fallback quando a posição salva ficou inválida.
 * O servidor valida inteiros, bounds, colisão e entidades ocupando o tile.
 */
import type { World } from "./World";

export interface TilePosition { x: number; y: number }

export function isSafePlayerPosition(world: World, value: TilePosition): boolean {
  return Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y) &&
    world.isPositionWalkable(value.x, value.y);
}

/**
 * Procura primeiro o spawn definido no mapa; se estiver ocupado/bloqueado,
 * busca o tile caminhável mais próximo por distância Manhattan.
 * Não aceita fallback silencioso para (0,0) ou para coordenadas não válidas.
 */
export function findSafePlayerPosition(world: World, preferred: TilePosition): TilePosition {
  if (!Number.isSafeInteger(preferred.x) || !Number.isSafeInteger(preferred.y) ||
      !world.isWithinBounds(preferred.x, preferred.y))
    throw new Error("[PlayerSpawn] Spawn Tiled inválido (fora do mapa ou coordenadas não inteiras).");

  // Busca ao redor do ponto indicado pelo Tiled. O jogo é grid-based.
  const maxRadius = Math.max(world.width + world.height, 0);
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const remaining = radius - Math.abs(dy);
      const offsets = remaining === 0 ? [0] : [-remaining, remaining];
      for (const dx of offsets) {
        const candidate = { x: preferred.x + dx, y: preferred.y + dy };
        if (isSafePlayerPosition(world, candidate)) return candidate;
      }
    }
  }
  throw new Error("[PlayerSpawn] Nenhum tile caminhável disponível próximo ao spawn Tiled.");
}
