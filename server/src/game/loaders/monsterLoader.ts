/**
 * Carrega cada ponto MonsterSpawn do Tiled UMA vez.
 *
 * Cada ponto possui ID estável (spawnPointId); cada vida do monstro possui
 * outro ID (monster.id), renovado quando a criatura reaparece.
 */
import { World } from "../world/World";
import { Monster } from "../entities/monster";
import { MonsterAI } from "../ai/monsterAi";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { Logger } from "../core/logger/logger";
import { MonsterSpawnData } from "../../shared/interfaces/spawn.interface";
import { generateId } from "../../shared/utils/idUtils";

export class MonsterLoader {
  static spawnMonsters(world: World, spawns: MonsterSpawnData[]): void {
    for (const spawn of spawns) {
      // Não criar monstros fora do mapa, nem em tiles bloqueados no Tiled.
      if (!Number.isInteger(spawn.x) || !Number.isInteger(spawn.y) ||
          !world.isWithinBounds(spawn.x, spawn.y) ||
          !world.getTile(spawn.x, spawn.y)?.walkable) {
        Logger.warn(`[MonsterLoader] Spawn inválido para ${spawn.monsterId} em (${spawn.x},${spawn.y}).`);
        continue;
      }

      const definition = MonsterRegistry.get(spawn.monsterId);
      if (!definition) {
        Logger.warn(`[MonsterLoader] Monstro desconhecido: ${spawn.monsterId}.`);
        continue;
      }

      // Um ID de spawn é persistente; o ID da entidade é sempre renovável.
      const spawnPointId = spawn.id ?? generateId();
      if (world.spawnPoints.some((point) => point.id === spawnPointId)) {
        Logger.warn(`[MonsterLoader] Ponto de spawn duplicado: ${spawnPointId}.`);
        continue;
      }

      const monster = new Monster(
        generateId(),
        definition,
        spawn.x,
        spawn.y,
        new MonsterAI(),
        spawn.radius ?? 3,
        spawn.respawnTime ?? 10000,
        spawnPointId,
      );

      world.addMonster(monster);
      world.spawnPoints.push({ ...spawn, id: spawnPointId });
      Logger.world(`[MonsterLoader] ${definition.name} em (${spawn.x},${spawn.y}); spawn=${spawnPointId}.`);
    }
  }
}
