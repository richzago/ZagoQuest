/**
 * map.interface.ts
 *
 * Estruturas de dados brutas para mapas exportados do Tiled.
 * Contém apenas as interfaces que espelham o formato JSON do Tiled.
 *
 * @module shared/interfaces/map
 */

export interface TiledLayer {
  name: string;
  data?: number[];
  width: number;
  height: number;
  visible: boolean;
  type: "tilelayer" | "objectgroup";
  objects?: TiledObject[];
  properties?: TiledProperty[];
  opacity?: number;
  draworder?: string;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gid?: number;
  properties?: TiledProperty[];
  rotation?: number;
  visible?: boolean;
}

export interface TiledProperty {
  name: string;
  type: string;
  value: any;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets?: any[];
  orientation?: string;
  tiledversion?: string;
  version?: string;
  nextlayerid?: number;
  nextobjectid?: number;
}
