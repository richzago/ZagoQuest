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
 *
 * @module game/systems/SpawnSystem
 */

import { World } from "../world/World";
import { Monster } from "../entities/monster";
import { MonsterRegistry } from "../../data/monsters/monsterRegistry";
import { MonsterAI } from "../ai/monsterAi";
import { Logger } from "../core/logger/logger";
import { ActiveSpawn, SpawnPointData } from "../../shared/interfaces/spawn.interface";

/**
 * Gerencia pontos de spawn de monstros e seus respawns.
 *
 * @remarks
 * O sistema mantém um mapa de `ActiveSpawn` para cada ponto de spawn, controlando:
 * - O monstro atualmente vivo (se houver)
 * - Se há um respawn pendente
 * - Um timer para o respawn
 *
 * Quando um monstro morre, o `DeathSystem` deve chamar `onMonsterDeath` para que o respawn seja agendado.
 *
 * @example
 * ```typescript
 * const spawnSystem = new SpawnSystem(world);
 * spawnSystem.loadSpawnPoints([
 *   { id: "rat1", monsterId: "animals/lowlevel/rat", x: 10, y: 5, respawnTimeMs: 10000 }
 * ]);
 * // Quando um monstro morrer:
 * spawnSystem.onMonsterDeath(monster);
 * ```
 */
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
   * @param spawnsData - Array de SpawnPointData (posição, monstroId, respawnTime, initialDelay opcional)
   * @returns {void}
   *
   * @remarks
   * Se o spawn point tiver `initialDelayMs`, o primeiro spawn só ocorrerá após esse tempo.
   * Caso contrário, o monstro nasce imediatamente.
   * Todos os pontos são registrados no mapa `activeSpawns` com `pendingRespawn = false`.
   *
   * @example
   * ```typescript
   * const spawns = [
   *   { id: "rat1", monsterId: "animals/lowlevel/rat", x: 10, y: 5, respawnTimeMs: 10000 },
   *   { id: "boss1", monsterId: "bosses/dragon", x: 20, y: 15, respawnTimeMs: 60000, initialDelayMs: 5000 }
   * ];
   * spawnSystem.loadSpawnPoints(spawns);
   * ```
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
   * @param data - Dados do spawn (posição, monsterId)
   * @returns {void}
   *
   * @remarks
   * O monstro é criado com um ID sequencial (evita conflitos) e uma IA padrão (`MonsterAI`).
   * Após adicionar ao mundo, o registro ativo é atualizado com o ID do monstro e `pendingRespawn = false`.
   * Se o monstro não for encontrado no `MonsterRegistry`, um erro é registrado e o spawn é ignorado.
   *
   * @example
   * ```typescript
   * // Chamado internamente por loadSpawnPoints ou pelo timer de respawn
   * private spawnMonster(data)
   * ```
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
   * @returns {void}
   *
   * @remarks
   * O sistema procura qual spawn point possui `monsterId` igual ao ID do monstro morto.
   * Se encontrado, marca `pendingRespawn = true`, cancela qualquer timer anterior,
   * e agenda um novo respawn após `respawnTimeMs` milissegundos.
   * O timer armazenado permite cancelamento caso o jogo seja encerrado durante a espera.
   *
   * @example
   * ```typescript
   * // No DeathSystem.handleMonsterDeath, após marcar HP=0:
   * world.spawnSystem?.onMonsterDeath(monster);
   * ```
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
