/**
 * Map Grid data structures for MetroMap.io
 */

export type TileType = "LAND" | "WATER";
export type MapType = "RIVER" | "ARCHIPELAGO";

export interface GridSquare {
  x: number;
  y: number;
  type: TileType;
  homeDensity: number; // 0-100, for future use
  officeDensity: number; // 0-100, for future use
}

export interface MapGrid {
  width: number;
  height: number;
  seed: number;
  mapType: MapType;
  squares: GridSquare[][];
}

export const MAP_WIDTH = 48;
export const MAP_HEIGHT = 32;
