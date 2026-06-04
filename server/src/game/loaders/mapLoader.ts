/**
 * mapLoader.ts
 *
 * Carrega um mapa exportado do Tiled (formato JSON) e constrói o mundo.
 *
 * @module game/loaders/MapLoader
 */

import { World } from "../world/World";
import { Tile } from "../world/tile";
import { Logger } from "../core/logger/logger";
import { readFileSync } from "fs";
import { TiledMap } from "../../shared/interfaces/map.interface";

/**
 * Classe estática responsável por carregar mapas do Tiled.
 */
export class MapLoader {
  /**
   * Carrega um mapa a partir de um arquivo JSON exportado do Tiled.
   *
   * @param world - Instância do mundo a ser populada.
   * @param filePath - Caminho absoluto ou relativo ao arquivo JSON (ex: "assets/maps/zagoworld.json").
   * @returns {void}
   *
   * @remarks
   * O mapa deve conter pelo menos duas camadas:
   * - `ground`: define os tiles do chão (todos são caminháveis).
   * - `collision`: define os tiles bloqueados (tiles com data > 0 tornam walkable = false).
   *
   * @example
   * ```typescript
   * const mapPath = join(process.cwd(), "assets", "maps", "zagoworld.json");
   * MapLoader.loadMap(world, mapPath);
   * ```
   */
  static loadMap(world: World, filePath: string): void {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const mapData: TiledMap = JSON.parse(raw);

      // Redimensiona o mundo
      world.width = mapData.width;
      world.height = mapData.height;
      world.tiles.clear();

      // Inicializa todos os tiles como caminháveis (walkable = true)
      for (let x = 0; x < world.width; x++) {
        for (let y = 0; y < world.height; y++) {
          world.tiles.set(`${x},${y}`, new Tile(x, y, true));
        }
      }

      // Processa cada camada
      for (const layer of mapData.layers) {
        if (layer.name === "collision") {
          // Marca tiles como não caminháveis onde houver tile (data > 0)
          for (let y = 0; y < layer.height; y++) {
            for (let x = 0; x < layer.width; x++) {
              const idx = y * layer.width + x;
              if (layer.data[idx] !== 0) {
                const tile = world.getTile(x, y);
                if (tile) tile.walkable = false;
              }
            }
          }
          Logger.world(`Camada de colisão processada (${layer.name})`);
        } else if (layer.name === "spawns") {
          // Futuramente: extrair pontos de spawn de monstros/NPCs
          Logger.world(`Camada de spawns encontrada (ainda não implementada)`);
        } else {
          // Outras camadas (ground, details) não afetam a lógica do servidor
          Logger.world(`Camada ignorada: ${layer.name}`);
        }
      }

      Logger.world(`Mapa carregado: ${mapData.width}x${mapData.height} a partir de ${filePath}`);
    } catch (error: any) {
      Logger.error(`Falha ao carregar mapa: ${error.message}`);
      throw error;
    }
  }
}
