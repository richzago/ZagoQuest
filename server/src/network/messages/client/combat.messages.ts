/**
 * Mensagens de combate enviadas pelo cliente.
 * @module messages/client/combat
 */

/**
 * Ataque manual a um alvo.
 */
export interface ClientAttackMessage {
  type: "attack";
  targetId: string;
}

/**
 * Iniciar ataque automático.
 */
export interface ClientStartAutoAttackMessage {
  type: "startAutoAttack";
  targetId: string;
}

/**
 * Parar ataque automático.
 */
export interface ClientStopAutoAttackMessage {
  type: "stopAutoAttack";
}
