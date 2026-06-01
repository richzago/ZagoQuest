/**
 * Entidade que pode receber dano (Player, Monster).
 * Nota: não estende Entity para evitar dependência circular.
 */
export interface Damageable {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  position: { x: number; y: number };
}
