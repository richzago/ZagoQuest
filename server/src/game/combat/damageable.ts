import { Entity } from "../entities/entity";

/**
 * Qualquer entidade que pode sofrer dano
 */
export interface Damageable extends Entity {
  hp: number;
  maxHp: number;
}
