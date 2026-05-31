import { World } from "../world/world";
import { Monster } from "../entities/monster";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { MonsterAI } from "../ai/monsterAi";
import { SpawnPointData } from "../../data/spawns/spawnPoint";
import { Logger } from "../core/logger/logger";

interface ActiveSpawn {
  data: SpawnPointData;
  monsterId?: number; // id da entidade do monstro vivo
  respawnTimer?: NodeJS.Timeout;
  pendingRespawn: boolean;
}

export class SpawnSystem {
  private activeSpawns: Map<string, ActiveSpawn> = new Map();
  private world: World;
  private nextMonsterId = 1000; // ids únicos para monstros

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Carrega uma lista de spawn points a partir de um array de dados
   */
  public loadSpawnPoints(spawnsData: SpawnPointData[]): void {
    for (const data of spawnsData) {
      this.activeSpawns.set(data.id, {
        data,
        pendingRespawn: false,
      });
      // Se não tiver delay inicial, spawna imediatamente
      if (!data.initialDelayMs) {
        this.spawnMonster(data);
      } else {
        setTimeout(() => this.spawnMonster(data), data.initialDelayMs);
      }
    }
    Logger.world(`Carregados ${spawnsData.length} pontos de spawn.`);
  }

  /**
   * Instancia um monstro no mundo a partir dos dados do spawn
   */
  private spawnMonster(data: SpawnPointData): void {
    const monsterDef = MonsterRegistry.get(data.monsterId);
    if (!monsterDef) {
      Logger.error(`Monstro ${data.monsterId} não encontrado para spawn ${data.id}`);
      return;
    }

    const monster = new Monster(
      this.nextMonsterId++,
      monsterDef,
      data.x,
      data.y,
      new MonsterAI(), // você pode passar configurações especiais se quiser
    );

    this.world.addMonster(monster);
    const active = this.activeSpawns.get(data.id);
    if (active) {
      active.monsterId = monster.id;
      active.pendingRespawn = false;
    }

    Logger.world(`Spawn: ${monster.name} em (${data.x}, ${data.y})`);
  }

  /**
   * Deve ser chamado quando um monstro morre.
   * Agenda o respawn se ele pertencer a algum spawn point.
   */
  public onMonsterDeath(monster: Monster): void {
    for (const [spawnId, active] of this.activeSpawns.entries()) {
      if (active.monsterId === monster.id && !active.pendingRespawn) {
        active.pendingRespawn = true;
        active.monsterId = undefined;

        // Agenda o respawn
        if (active.respawnTimer) clearTimeout(active.respawnTimer);
        active.respawnTimer = setTimeout(() => {
          this.spawnMonster(active.data);
          active.respawnTimer = undefined;
        }, active.data.respawnTimeMs);

        Logger.world(
          `Monstro morto em spawn ${spawnId}. Respawn em ${active.data.respawnTimeMs}ms`,
        );
        break;
      }
    }
  }
}
