/**
 * Map Grid data structures for MetroMap.io
 */

import { MAP_WIDTH, MAP_HEIGHT } from "../config";

export type TileType = "LAND" | "WATER";
export type MapType = "RIVER" | "ARCHIPELAGO";

export interface GridSquare {
  x: number;
  y: number;
  type: TileType;
  homeDensity: number; // 0-99
  officeDensity: number; // 0-99
}

export interface MapGrid {
  width: number;
  height: number;
  seed: number;
  mapType: MapType;
  squares: GridSquare[][];
}

export { MAP_WIDTH, MAP_HEIGHT };
