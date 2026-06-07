/**
 * monsterLoader.ts
 *
 * Responsável por instanciar monstros no mundo a partir de dados de spawn.
 * Utiliza o MonsterRegistry (que suporta nomes curtos) para obter as definições.
 *
 * @module game/loaders/monsterLoader
 */

import { World } from "../world/World";
import { Monster } from "../entities/monster";
import { MonsterAI } from "../ai/monsterAi";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { Logger } from "../core/logger/logger";
import { MonsterSpawnData } from "../../shared/interfaces/spawn.interface";

/**
 * Loader especializado para criação de monstros.
 */
export class MonsterLoader {
  /**
   * Instancia e adiciona monstros ao mundo a partir de uma lista de spawns.
   *
   * @param world - Mundo onde os monstros serão inseridos.
   * @param spawns - Lista de spawns (cada um com coordenadas e monsterId, podendo ser nome curto ou caminho completo).
   *
   * @remarks
   * - Gera um ID numérico único para cada monstro.
   * - O `monsterId` pode ser um caminho completo (ex: "animals/lowlevel/rat") ou um nome curto (ex: "rat").
   * - Se o monstro não for encontrado, loga um erro e pula o spawn.
   */
  static spawnMonsters(world: World, spawns: MonsterSpawnData[]): void {
    for (const spawn of spawns) {
      // Busca a definição do monstro (suporta nome curto)
      const monsterDef = MonsterRegistry.get(spawn.monsterId);
      if (!monsterDef) {
        Logger.error(`[MonsterLoader] Monstro ${spawn.monsterId} não encontrado no registro.`);
        continue;
      }

      // Gera um ID único para o monstro (evita colisões)
      const uniqueId = world.monsters.length + 1000 + Math.floor(Math.random() * 10000);

      // Instancia o monstro com sua IA padrão
      const monster = new Monster(uniqueId, monsterDef, spawn.x, spawn.y, new MonsterAI());

      // Futuramente: sobrescrever respawnTime e radius se fornecidos
      // if (spawn.respawnTime !== undefined) monster.respawnTime = spawn.respawnTime;
      // if (spawn.radius !== undefined) monster.wanderRadius = spawn.radius;

      world.addMonster(monster);
      Logger.world(
        `[MonsterLoader] Monstro ${spawn.monsterId} spawnado em (${spawn.x}, ${spawn.y})`,
      );
    }
  }
}
