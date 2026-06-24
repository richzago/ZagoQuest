/**
 * Mensagens de movimento enviadas pelo cliente.
 * @module messages/client/movement
 */

export type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

/**
 * Movimento por coordenadas absolutas (usado em clique no mapa ou chat).
 */
export interface ClientMoveMessage {
  type: "move";
  x: number;
  y: number;
}

/**
 * Movimento por direção (estilo Tibia – teclas WASD e diagonais).
 */
export interface ClientMoveDirMessage {
  type: "moveDir";
  dir: Direction;
}
