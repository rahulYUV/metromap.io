/**
 * Map Renderer for MetroMap.io
 * Renders the generated map grid using Pixi.js Graphics
 * Simple square tile rendering
 */

import { Container, Graphics } from "pixi.js";
import { type MapGrid, MAP_WIDTH, MAP_HEIGHT } from "./models/MapGrid";

// Visual constants
const TILE_SIZE = 16;
const WATER_COLOR = 0x4a90e2;
const LAND_COLOR = 0xe8e8e8;
const GRID_LINE_COLOR = 0xd0d0d0;
const GRID_LINE_ALPHA = 0.3;

export class MapRenderer extends Container {
  private mapGraphics: Graphics;
  private gridGraphics: Graphics;
  private currentMap: MapGrid | null = null;

  constructor() {
    super();

    // Map tiles layer
    this.mapGraphics = new Graphics();
    this.addChild(this.mapGraphics);

    // Grid overlay layer
    this.gridGraphics = new Graphics();
    this.addChild(this.gridGraphics);
  }

  /**
   * Render the given map
   */
  public renderMap(map: MapGrid): void {
    this.currentMap = map;
    this.mapGraphics.clear();
    this.gridGraphics.clear();

    // Draw each tile as a simple square
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const square = map.squares[y][x];
        const color = square.type === "WATER" ? WATER_COLOR : LAND_COLOR;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
        this.mapGraphics.fill(color);
      }
    }

    // Draw grid lines
    this.drawGridLines();
  }

  /**
   * Draw grid lines overlay
   */
  private drawGridLines(): void {
    this.gridGraphics.setStrokeStyle({
      width: 1,
      color: GRID_LINE_COLOR,
      alpha: GRID_LINE_ALPHA,
    });

    // Vertical lines
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridGraphics.moveTo(x * TILE_SIZE, 0);
      this.gridGraphics.lineTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }

    // Horizontal lines
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridGraphics.moveTo(0, y * TILE_SIZE);
      this.gridGraphics.lineTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }

    this.gridGraphics.stroke();
  }

  /**
   * Get the total width of the rendered map
   */
  public getMapWidth(): number {
    return MAP_WIDTH * TILE_SIZE;
  }

  /**
   * Get the total height of the rendered map
   */
  public getMapHeight(): number {
    return MAP_HEIGHT * TILE_SIZE;
  }

  /**
   * Get tile size for external calculations
   */
  public getTileSize(): number {
    return TILE_SIZE;
  }

  /**
   * Clear the map display
   */
  public clear(): void {
    this.mapGraphics.clear();
    this.gridGraphics.clear();
    this.currentMap = null;
  }

  /**
   * Get the current map being displayed
   */
  public getCurrentMap(): MapGrid | null {
    return this.currentMap;
  }
}
