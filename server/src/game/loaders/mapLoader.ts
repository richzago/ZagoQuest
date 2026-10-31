/**
 * mapLoader.ts
 *
 * Carrega um mapa exportado do Tiled (formato JSON) e constrói o mundo.
 * Suporta:
 * - Tile layers (Ground, Decoration, Collision) – usadas para terreno e colisão
 * - Object layers:
 *   - PlayerSpawn: define onde o jogador aparece
 *   - MonsterSpawn: define spawns de monstros (cada objeto com propriedade `monsterId`)
 *   - (futuro) NPCSpawn, etc.
 *
 * @module game/loaders/MapLoader
 */

import { World } from "../world/World";
import { Tile } from "../world/tile";
import { Logger } from "../core/logger/logger";
import { readFileSync } from "fs";
import { TiledMap, TiledObject } from "../../shared/interfaces/map.interface";
import type { NpcSpawnData } from "../../shared/interfaces/spawn.interface";

/**
 * Resultado do carregamento do mapa: posição inicial do jogador e lista de monstros a serem criados.
 */
export interface MapLoadResult {
  /** Posição (em tiles) onde o jogador deve nascer */
  playerSpawn?: { x: number; y: number };
  /** Optional independent Tiled RespawnSpawn layer; defaults to PlayerSpawn. */
  respawnSpawn?: { x: number; y: number };
  /** Lista de monstros a serem instanciados */
  monsters: Array<{
    x: number;
    y: number;
    monsterId: string;
    /** Tempo de respawn específico (ms). Se omitido, usa o padrão do monstro. */
    respawnTime?: number;
    /** Raio de movimento (wander). Se omitido, usa o padrão do monstro. */
    radius?: number;
  }>;
  /** (Reservado para NPCs) */
  npcs?: NpcSpawnData[];
}

export class MapLoader {
  /**
   * Carrega um mapa a partir de um arquivo JSON exportado do Tiled.
   * Modifica o mundo (dimensões, tiles, walkable) e retorna informações de spawn.
   *
   * @param world - Instância do mundo a ser populada (já criada, mas sem tiles)
   * @param filePath - Caminho absoluto ou relativo ao arquivo JSON do mapa
   * @returns Informações de spawn para o jogo (jogador, monstros)
   *
   * @throws {Error} Se o arquivo não existir ou o JSON estiver malformado.
   *
   * @remarks
   * - Assume que tiles com `walkable = true` por padrão, a menos que a layer `Collision` indique o contrário.
   * - A layer `PlayerSpawn` deve conter um objeto com `name = "Knight"` ou `type = "player"`.
   * - A layer `MonsterSpawn` deve conter objetos retangulares/pontos. Cada objeto pode ter:
   *   - `monsterId` (string, obrigatório) – caminho relativo a `data/monsters/`, ex: `animals/lowlevel/rat`.
   *   - `respawnTime` (int, opcional) – em ms, sobrescreve o padrão do monstro.
   *   - `radius` (int, opcional) – raio de movimento, sobrescreve o padrão.
   * - Se um objeto não tiver `monsterId`, ele é ignorado e um aviso é emitido.
   *
   * @example
   * ```typescript
   * const world = new World();
   * const { playerSpawn, monsters } = MapLoader.loadMap(world, 'assets/maps/test-map.json');
   * ```
   */
  static loadMap(world: World, filePath: string): MapLoadResult {
    const result: MapLoadResult = { monsters: [] };

    try {
      // 1. Leitura e parse do JSON
      const raw = readFileSync(filePath, "utf-8");
      const mapData: TiledMap = JSON.parse(raw);

      // 2. Redimensiona o mundo e limpa os tiles existentes
      world.width = mapData.width;
      world.height = mapData.height;
      world.tiles.clear();

      // 3. Inicializa todos os tiles como caminháveis (walkable = true)
      for (let x = 0; x < world.width; x++) {
        for (let y = 0; y < world.height; y++) {
          world.tiles.set(`${x},${y}`, new Tile(x, y, true));
        }
      }

      // 4. Processa a camada de colisão (Tile Layer chamada "Collision")
      const collisionLayer = mapData.layers.find(
        (l) => l.name === "Collision" && l.type === "tilelayer",
      );
      if (collisionLayer && collisionLayer.data) {
        for (let y = 0; y < collisionLayer.height; y++) {
          for (let x = 0; x < collisionLayer.width; x++) {
            const idx = y * collisionLayer.width + x;
            // Tiled guarda a linha 0 no TOPO, mas Unity e World usam Y
            // crescente para CIMA. Espelhar a posição da Collision da
            // mesma forma que TiledMapRenderer.DrawLayer faz no Ground.
            if (collisionLayer.data[idx] !== 0) {
              const worldY = mapData.height - 1 - y;
              const tile = world.getTile(x, worldY);
              if (tile) tile.walkable = false;
            }
          }
        }
        Logger.world(`Camada de colisão processada (${collisionLayer.name})`);
      } else {
        Logger.warn(
          "[MapLoader] Nenhuma camada 'Collision' encontrada. Todos os tiles são caminháveis.",
        );
      }

      // 5. Processa todas as object layers (grupos de objetos)
      for (const layer of mapData.layers) {
        if (layer.type !== "objectgroup") continue;

        // -------------------- PLAYER SPAWN --------------------
        if (layer.name === "PlayerSpawn") {
          // Tiled stores custom properties separately from the object's own
          // "type" field. Accept both, plus the conventional object name.
          const playerObj = layer.objects?.find((obj) => {
            const customType = obj.properties?.find(
              (property) => property.name === "type",
            )?.value;
            const name = obj.name?.trim().toLowerCase();
            return name === "knight" || name === "player" ||
              obj.type?.trim().toLowerCase() === "player" ||
              customType === "player";
          });
          if (playerObj) {
            const tileX = Math.floor(playerObj.x / mapData.tilewidth);
            const tileY = Math.floor(playerObj.y / mapData.tileheight);
            result.playerSpawn = { x: tileX, y: tileY };
            Logger.world(`Spawn do jogador em (${tileX}, ${tileY})`);
          } else {
            Logger.warn(
              "[MapLoader] PlayerSpawn sem objeto Knight/player ou propriedade type=player.",
            );
          }
        }
        // -------------------- MONSTER SPAWN (GENÉRICO) --------------------
        else if (layer.name === "MonsterSpawn") {
          // Propriedades padrão podem ser definidas no nível da layer (ex: monsterId padrão para todos os objetos)
          const defaultMonsterId = layer.properties?.find((p) => p.name === "monsterId")?.value;
          const defaultRespawnTime = layer.properties?.find((p) => p.name === "respawnTime")?.value;
          const defaultRadius = layer.properties?.find((p) => p.name === "radius")?.value;

          for (const obj of layer.objects || []) {
            // Converte coordenadas de pixels para tiles (considerando o canto superior esquerdo do objeto)
            const tileX = Math.floor(obj.x / mapData.tilewidth);
            const tileY = Math.floor(obj.y / mapData.tileheight);

            // Lê as propriedades do objeto (prioridade sobre as padrão da layer)
            let monsterId = obj.properties?.find((p) => p.name === "monsterId")?.value;
            if (!monsterId && defaultMonsterId) monsterId = defaultMonsterId;

            // Se não há monsterId, pula este objeto (log de aviso)
            if (!monsterId) {
              Logger.warn(
                `[MapLoader] Objeto em MonsterSpawn na posição (${tileX}, ${tileY}) não possui 'monsterId'. Ignorado.`,
              );
              continue;
            }

            // Propriedades opcionais (respawnTime e radius)
            let respawnTime = obj.properties?.find((p) => p.name === "respawnTime")?.value;
            if (respawnTime === undefined && defaultRespawnTime !== undefined)
              respawnTime = defaultRespawnTime;

            let radius = obj.properties?.find((p) => p.name === "radius")?.value;
            if (radius === undefined && defaultRadius !== undefined) radius = defaultRadius;

            result.monsters.push({
              x: tileX,
              y: tileY,
              monsterId: String(monsterId),
              respawnTime: respawnTime ? Number(respawnTime) : undefined,
              radius: radius ? Number(radius) : undefined,
            });
            Logger.world(
              `Spawn de monstro '${monsterId}' em (${tileX}, ${tileY})${respawnTime ? ` (respawn: ${respawnTime}ms)` : ""}`,
            );
          }
        }
        // -------------------- RESPAWN DO JOGADOR --------------------
        // A layer RespawnSpawn é opcional. Sem ela, usa-se PlayerSpawn.
        // Nenhuma coordenada do cliente ou valor fixo no DeathSystem.
        else if (layer.name === "RespawnSpawn") {
          const obj = layer.objects?.find((candidate) => {
            const label = (candidate.name || candidate.type || "").trim().toLowerCase();
            const custom = candidate.properties?.find((p) =>
              p.name === "type" || p.name === "spawnType")?.value;
            return label === "respawn" || label === "player" || custom === "respawn";
          });
          if (obj) {
            const x = Math.floor(obj.x / mapData.tilewidth);
            const y = Math.floor(obj.y / mapData.tileheight);
            result.respawnSpawn = { x, y };
          } else {
            Logger.warn("[MapLoader] RespawnSpawn sem objeto player/respawn; usando PlayerSpawn.");
          }
        }
        // --------------------  NPC SPAWN --------------------
        else if (layer.name === "NPCSpawn") {
          for (const obj of layer.objects || []) {
            const npcId = obj.properties?.find((p) => p.name === "npcId")?.value;
            if (!npcId) {
              Logger.warn(
                `[MapLoader] Objeto em NPCSpawn sem 'npcId' em (${Math.floor(obj.x / mapData.tilewidth)}, ${Math.floor(obj.y / mapData.tileheight)})`,
              );
              continue;
            }
            const x = Math.floor(obj.x / mapData.tilewidth);
            const y = Math.floor(obj.y / mapData.tileheight);
            result.npcs = result.npcs || [];
            const property = (name: string): number | undefined => {
              const value = obj.properties?.find((p) => p.name === name)?.value;
              return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
            };
            result.npcs.push({
              x, y, npcId: String(npcId),
              objectId: Number.isSafeInteger(obj.id) && obj.id > 0 ? obj.id : undefined,
              radius: property("radius"),
              interactionRadius: property("interactionRadius"),
              moveCooldown: property("moveCooldown"),
            });
            Logger.world(`[MapLoader] Spawn de NPC '${npcId}' em (${x}, ${y})`);
          }
        }
      }

      // Validar o ponto de renascimento DEPOIS de todas as layers:
      // a ordem de Collision e ObjectLayer no Tiled não importa.
      if (result.respawnSpawn && !world.getTile(
        result.respawnSpawn.x, result.respawnSpawn.y)?.walkable) {
        Logger.warn("[MapLoader] RespawnSpawn em tile bloqueado ou fora do mapa. Usando PlayerSpawn.");
        result.respawnSpawn = undefined;
      }

      Logger.world(`Mapa carregado: ${mapData.width}x${mapData.height} de ${filePath}`);
      return result;
    } catch (error: any) {
      Logger.error(`Falha ao carregar mapa: ${error.message}`);
      throw error; // Repassa o erro para que o caller decida o fallback
    }
  }
}
