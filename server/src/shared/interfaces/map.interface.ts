/**
 * map.interface.ts
 *
 * Estruturas de dados para mapas exportados do Tiled.
 *
 * @module shared/interfaces/Map
 */

export interface TiledLayer {
  name: string; // "ground", "collision", "spawns", etc.
  data: number[]; // array de tile IDs (0 = vazio)
  width: number;
  height: number;
  visible: boolean;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  // Outros campos podem ser adicionados conforme necessário
}
