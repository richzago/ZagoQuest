/**
 * monsterLoader.ts
 *
 * Responsável por instanciar monstros no mundo a partir de dados de spawn.
 * Utiliza o MonsterRegistry (que suporta nomes curtos) para obter as definições.
 * Armazena os pontos de spawn no mundo para permitir respawn futuro.
 *
 * @module game/loaders/monsterLoader
 */

import { World } from "../world/World";
import { Monster } from "../entities/monster";
import { MonsterAI } from "../ai/monsterAi";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { Logger } from "../core/logger/logger";
import { MonsterSpawnData } from "../../shared/interfaces/spawn.interface";
import { generateId } from "../../shared/utils/idUtils";

/**
 * Loader especializado para criação de monstros.
 *
 * @remarks
 * Além de instanciar os monstros, este loader também guarda os dados de spawn (posição,
 * monsterId, radius, respawnTime) em `world.spawnPoints` para que o sistema de respawn
 * possa recriar os monstros quando morrerem.
 */
export class MonsterLoader {
  /**
   * Instancia e adiciona monstros ao mundo a partir de uma lista de spawns.
   *
   * @param world - Mundo onde os monstros serão inseridos.
   * @param spawns - Lista de spawns (cada um com coordenadas, monsterId, radius opcional, respawnTime opcional).
   *
   * @remarks
   * - Gera um ID numérico único para cada monstro.
   * - O `monsterId` pode ser um caminho completo (ex: "animals/lowlevel/rat") ou um nome curto (ex: "rat").
   * - Se o monstro não for encontrado, loga um erro e pula o spawn.
   * - Cada spawn point é armazenado em `world.spawnPoints` para respawn futuro.
   *
   * @example
   * ```typescript
   * const spawns = [
   *   { x: 10, y: 15, monsterId: "goblin", radius: 3, respawnTime: 10000 }
   * ];
   * MonsterLoader.spawnMonsters(world, spawns);
   * ```
   */
  static spawnMonsters(world: World, spawns: MonsterSpawnData[]): void {
    for (const spawn of spawns) {
      const monsterDef = MonsterRegistry.get(spawn.monsterId);
      if (!monsterDef) continue;
      const uniqueId = generateId(); // ← UUID
      const monster = new Monster(
        uniqueId,
        monsterDef,
        spawn.x,
        spawn.y,
        new MonsterAI(),
        spawn.radius ?? 3,
        spawn.respawnTime ?? 10000,
      );
      world.addMonster(monster);
      world.spawnPoints.push({ ...spawn, id: uniqueId }); // 🔥 Armazena o ponto de spawn com o ID do monstro

      world.addMonster(monster);
      Logger.world(
        `[MonsterLoader] Monstro ${spawn.monsterId} spawnado em (${spawn.x}, ${spawn.y})`,
      );

      // 🔥 Armazena o ponto de spawn para respawn futuro
      world.spawnPoints.push(spawn);
    }
  }
}
