/**
 * spawnSystem.ts
 *
 * Gerencia o spawn e respawn automático de monstros.
 *
 * Funcionamento:
 * - Carrega uma lista de pontos de spawn (SpawnPointData) contendo: posição, monstro, tempo de respawn.
 * - Cada ponto cria um monstro imediatamente (ou após delay inicial).
 * - Quando um monstro morre, o SpawnSystem é notificado (via onMonsterDeath) e agenda um respawn após o tempo configurado.
 * - O monstro é removido do mundo pelo World.cleanupDeadMonsters(), e um novo é criado quando o timer disparar.
 *
 * Os IDs dos monstros são sequenciais (nextMonsterId) para garantir unicidade.
 */

import { World } from "../world/world";
import { Monster } from "../entities/monster";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { MonsterAI } from "../ai/monsterAi";
import { Logger } from "../core/logger/logger";
import { ActiveSpawn, SpawnPointData } from "../../shared/interfaces/spawn.interface";

export class SpawnSystem {
  private activeSpawns: Map<string, ActiveSpawn> = new Map();
  private world: World;
  private nextMonsterId = 1000; // IDs únicos para monstros (não conflita com IDs de outras entidades)

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Carrega uma lista de pontos de spawn (geralmente lida de um arquivo JSON).
   * Para cada ponto, inicia o primeiro spawn (com delay opcional).
   *
   * @param spawnsData - Array de SpawnPointData
   */
  public loadSpawnPoints(spawnsData: SpawnPointData[]): void {
    for (const data of spawnsData) {
      // Armazena o ponto no mapa ativo, ainda sem monstro
      this.activeSpawns.set(data.id, {
        data,
        pendingRespawn: false,
      });
      // Decide se deve spawnar imediatamente ou após delay
      if (!data.initialDelayMs) {
        this.spawnMonster(data);
      } else {
        setTimeout(() => this.spawnMonster(data), data.initialDelayMs);
      }
    }
    Logger.world(`Carregados ${spawnsData.length} pontos de spawn.`);
  }

  /**
   * Instancia um novo monstro no mundo, baseado nos dados do spawn point.
   *
   * @param data - Dados do spawn (posição, monstroId)
   */
  private spawnMonster(data: SpawnPointData): void {
    // Obtém a definição do monstro a partir do registry (JSON)
    const monsterDef = MonsterRegistry.get(data.monsterId);
    if (!monsterDef) {
      Logger.error(`Monstro ${data.monsterId} não encontrado para spawn ${data.id}`);
      return;
    }

    // Cria o monstro com ID único e IA padrão
    const monster = new Monster(
      this.nextMonsterId++,
      monsterDef,
      data.x,
      data.y,
      new MonsterAI(), // Futuramente pode receber configurações especiais via JSON
    );

    // Adiciona ao mundo
    this.world.addMonster(monster);

    // Atualiza o registro ativo com o ID do monstro
    const active = this.activeSpawns.get(data.id);
    if (active) {
      active.monsterId = monster.id;
      active.pendingRespawn = false;
    }

    Logger.world(`Spawn: ${monster.name} em (${data.x}, ${data.y})`);
  }

  /**
   * Deve ser chamado quando um monstro morre (geralmente pelo DeathSystem).
   * Se o monstro pertence a um spawn point, agenda seu respawn.
   *
   * @param monster - Monstro que morreu
   */
  public onMonsterDeath(monster: Monster): void {
    // Procura o spawn point que possui este monsterId
    for (const [spawnId, active] of this.activeSpawns.entries()) {
      if (active.monsterId === monster.id && !active.pendingRespawn) {
        active.pendingRespawn = true;
        active.monsterId = undefined;

        // Cancela timer anterior (se houver) e agenda novo respawn
        if (active.respawnTimer) clearTimeout(active.respawnTimer);
        active.respawnTimer = setTimeout(() => {
          this.spawnMonster(active.data);
          active.respawnTimer = undefined;
        }, active.data.respawnTimeMs);

        Logger.world(
          `Monstro morto em spawn ${spawnId}. Respawn em ${active.data.respawnTimeMs}ms`,
        );
        break; // Um monstro só pertence a um spawn point
      }
    }
  }
}
