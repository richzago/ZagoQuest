/**
 * monster.ts
 *
 * Representa uma criatura hostil ou passiva no mundo.
 * Herda de Creature e possui dados vindos do JSON (MonsterType).
 * Seu comportamento é controlado pela classe MonsterAI.
 *
 * @module game/entities/Monster
 */

import { Creature } from "./creature";
import { MonsterAI } from "../ai/monsterAi";
import { MonsterType } from "../../shared/interfaces/monster.interface";

export class Monster extends Creature {
  type: MonsterType;
  ai: MonsterAI;
  target?: Creature;

  /** Identifica o ponto fixo do Tiled; não muda entre respawns. */
  readonly spawnPointId?: string;
  /** Impede recompensas/corpos/respawns duplicados se a morte for processada duas vezes. */
  deathProcessed = false;

  /**
   * Danos REAIS sofridos durante esta vida, separados por ID do jogador.
   * Uma vida nova nasce com o ledger vazio; nunca copiar no respawn.
   */
  readonly damageByPlayer: Map<string, number> = new Map();

  recordPlayerDamage(playerId: string, damage: number): void {
    if (!playerId || !Number.isSafeInteger(damage) || damage <= 0 ||
        this.deathProcessed) return;
    const previous = this.damageByPlayer.get(playerId) ?? 0;
    if (Number.isSafeInteger(previous + damage))
      this.damageByPlayer.set(playerId, previous + damage);
  }

  spawnX: number;
  spawnY: number;
  wanderRadius: number;
  respawnTime: number; // Milissegundos entre morte e reaparecimento.

  constructor(
    id: string,
    type: MonsterType,
    x: number,
    y: number,
    ai: MonsterAI,
    wanderRadius: number = 3,
    respawnTime: number = 10000,
    spawnPointId?: string,
  ) {
    super(id, type.name, x, y);
    this.type = type;
    this.ai = ai;
    this.maxHp = type.stats.hp;
    this.hp = this.maxHp;
    this.maxMana = 0;
    this.mana = 0;
    this.level = (type as any).level || 1;
    this.experience = type.combat.xp;

    // define o ponto de origem e o raio de wander
    this.spawnX = x;
    this.spawnY = y;
    this.spawnPointId = spawnPointId;

    // Nunca agendar timer negativo/NaN: Node interpretaria como timeout mínimo.
    this.wanderRadius = Number.isSafeInteger(wanderRadius) && wanderRadius >= 0
      ? wanderRadius : 3;
    this.respawnTime = Number.isSafeInteger(respawnTime) &&
      respawnTime > 0 && respawnTime <= 2_147_483_647 ? respawnTime : 10000;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMana(): number {
    return 0;
  }
}
