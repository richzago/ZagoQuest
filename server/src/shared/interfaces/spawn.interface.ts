/**
 * spawn.interface.ts
 *
 * Interfaces relacionadas a spawns de entidades (jogador, monstros, NPCs)
 * carregados a partir do Tiled ou de outras fontes.
 *
 * @module shared/interfaces/spawn
 */

/**
 * Dados de spawn do jogador.
 */
export interface PlayerSpawnData {
  x: number;
  y: number;
}

/**
 * Dados de spawn de um monstro.
 */
export interface MonsterSpawnData {
  x: number;
  y: number;
  /** Identificador do monstro – pode ser nome curto (ex: "rat") ou caminho completo (ex: "animals/lowlevel/rat") */
  monsterId: string;
  /** Tempo de respawn personalizado (ms) – opcional, sobrescreve o padrão do monstro */
  respawnTime?: number;
  /** Raio de movimento (wander) em tiles – opcional, sobrescreve o padrão */
  radius?: number;
  id?: string;
}

/**
 * Dados de spawn de um NPC.
 */
export interface NpcSpawnData {
  x: number;
  y: number;
  /** Identificador do NPC (ex: "merchant", "banker") – corresponde ao nome do arquivo JSON em data/npc/ */
  npcId: string;
  /** Identificador do objeto no Tiled; usado para IDs estáveis de instâncias. */
  objectId?: number;
  /** Optional AI overrides from the NPCSpawn object in Tiled. */
  radius?: number;
  interactionRadius?: number;
  moveCooldown?: number;
}
