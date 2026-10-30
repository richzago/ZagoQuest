/**
 * Movimento autoritativo do jogador.
 *
 * O cliente pede UM passo; só o servidor decide se ele é permitido.
 * "move" (coordenada absoluta) e "moveDir" (direção) usam estas mesmas regras.
 * O relógio é injetável nos testes; no jogo usa performance.now() (monotônico).
 */
import type { Player } from "../entities/player";
import type { World } from "../world/World";
import type { Direction } from "../../network/messages/client/movement.messages";

export const MIN_MOVE_INTERVAL_MS = 150; // Ajustável sem alterar os handlers.

export type MoveResult = "moved" | "invalid" | "blocked" | "cooldown";

const OFFSETS: Record<Direction, readonly [number, number]> = {
  north: [0, 1],
  south: [0, -1],
  east: [1, 0],
  west: [-1, 0],
  northeast: [1, 1],
  northwest: [-1, 1],
  southeast: [1, -1],
  southwest: [-1, -1],
};

/** WeakMap não impede o GC de liberar jogadores desconectados. */
const lastAcceptedMove = new WeakMap<Player, number>();

export class MovementSystem {
  /**
   * Valida e executa um único passo até (x,y).
   * Nunca usa a posição enviada pelo cliente sem validar distância e colisão.
   */
  static moveTo(
    player: Player,
    world: World,
    x: unknown,
    y: unknown,
    now: number = performance.now(),
  ): MoveResult {
    const fromX = player.position.x;
    const fromY = player.position.y;

    // Mensagens JSON não garantem que coordenadas sejam inteiros.
    if (
      !Number.isSafeInteger(x) || !Number.isSafeInteger(y) ||
      !Number.isSafeInteger(fromX) || !Number.isSafeInteger(fromY) ||
      !Number.isFinite(now) || player.hp <= 0
    ) return "invalid";

    const dx = (x as number) - fromX;
    const dy = (y as number) - fromY;
    // Aceita somente um passo ortogonal ou diagonal, nunca teleporte/no-op.
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0))
      return "invalid";

    const previous = lastAcceptedMove.get(player);
    if (previous !== undefined && now - previous < MIN_MOVE_INTERVAL_MS)
      return "cooldown";

    if (!world.isPositionWalkable(x as number, y as number, player.id))
      return "blocked";

    // Na diagonal, ambos os tiles laterais precisam estar livres:
    // evita passar entre duas paredes ou atravessar o canto de uma parede.
    if (dx !== 0 && dy !== 0 && (
      !world.isPositionWalkable(fromX + dx, fromY, player.id) ||
      !world.isPositionWalkable(fromX, fromY + dy, player.id)
    )) return "blocked";

    player.position.x = x as number;
    player.position.y = y as number;
    lastAcceptedMove.set(player, now); // Limita somente passos ACEITOS.
    return "moved";
  }

  /** Converte direções confiáveis para um passo; rejeita chaves herdadas do JS. */
  static moveDirection(
    player: Player,
    world: World,
    direction: unknown,
    now: number = performance.now(),
  ): MoveResult {
    if (
      typeof direction !== "string" ||
      !Object.prototype.hasOwnProperty.call(OFFSETS, direction)
    ) return "invalid";

    const [dx, dy] = OFFSETS[direction as Direction];
    return this.moveTo(
      player, world, player.position.x + dx, player.position.y + dy, now,
    );
  }
}
