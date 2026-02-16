/**
 * Map Renderer for MetroMap.io
 * Renders the generated map grid using Pixi.js Graphics
 * Simple square tile rendering
 */

import { Container, Graphics } from "pixi.js";
import type { MapGrid } from "@core/game/models/MapGrid";
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from "@core/game/config";

// Visual constants
const WATER_COLOR = 0x4a90e2;
const LAND_COLOR = 0xe8e8e8;
const GRID_LINE_COLOR = 0xd0d0d0;
const GRID_LINE_ALPHA = 0.3;

export type VisualizationMode = "DEFAULT" | "RESIDENTIAL" | "OFFICE" | "BOTH";

export class PixiMapRenderer extends Container {
  private mapGraphics: Graphics;
  private gridGraphics: Graphics;
  private currentMap: MapGrid | null = null;
  private visualizationMode: VisualizationMode = "DEFAULT";

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
    this.redraw();
  }

  /**
   * Set visualization mode and re-render
   */
  public setVisualizationMode(mode: VisualizationMode): void {
    this.visualizationMode = mode;
    if (this.currentMap) {
      this.redraw();
    }
  }

  /**
   * Get current visualization mode
   */
  public getVisualizationMode(): VisualizationMode {
    return this.visualizationMode;
  }

  /**
   * Redraw the map with current visualization mode
   */
  private redraw(): void {
    if (!this.currentMap) return;

    this.mapGraphics.clear();
    this.gridGraphics.clear();

    // Draw each tile based on visualization mode
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const square = this.currentMap.squares[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (square.type === "WATER") {
          // Water tiles are always blue
          this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
          this.mapGraphics.fill(WATER_COLOR);
        } else if (this.visualizationMode === "BOTH") {
          // Split tile diagonally: top-left = residential (green), bottom-right = office (red)
          const resColor = this.getResidentialColor(square.homeDensity);
          const offColor = this.getOfficeColor(square.officeDensity);

          // Draw bottom-right triangle (office) - draw first so residential overlays
          this.mapGraphics.moveTo(px + TILE_SIZE, py); // top-right
          this.mapGraphics.lineTo(px + TILE_SIZE, py + TILE_SIZE); // bottom-right
          this.mapGraphics.lineTo(px, py + TILE_SIZE); // bottom-left
          this.mapGraphics.lineTo(px + TILE_SIZE, py); // back to top-right
          this.mapGraphics.fill(offColor);

          // Draw top-left triangle (residential)
          this.mapGraphics.moveTo(px, py); // top-left
          this.mapGraphics.lineTo(px + TILE_SIZE, py); // top-right
          this.mapGraphics.lineTo(px, py + TILE_SIZE); // bottom-left
          this.mapGraphics.lineTo(px, py); // back to top-left
          this.mapGraphics.fill(resColor);
        } else {
          // Single color tile based on mode
          let color: number;

          if (this.visualizationMode === "RESIDENTIAL") {
            color = this.getResidentialColor(square.homeDensity);
          } else if (this.visualizationMode === "OFFICE") {
            color = this.getOfficeColor(square.officeDensity);
          } else {
            color = LAND_COLOR;
          }

          this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
          this.mapGraphics.fill(color);
        }
      }
    }

    // Draw grid lines
    this.drawGridLines();
  }

  /**
   * Get color for residential density (green shades)
   * Density 0-99 maps to light to dark green
   */
  private getResidentialColor(density: number): number {
    if (density === 0) {
      return LAND_COLOR; // No density = default land color
    }

    // Green gradient: from light green (low density) to dark green (high density)
    // RGB: light green (144, 238, 144) to dark green (0, 100, 0)
    const ratio = density / 99;
    const r = Math.floor(144 * (1 - ratio) + 0 * ratio);
    const g = Math.floor(238 * (1 - ratio) + 150 * ratio);
    const b = Math.floor(144 * (1 - ratio) + 0 * ratio);

    return (r << 16) | (g << 8) | b;
  }

  /**
   * Get color for office density (red shades)
   * Density 0-99 maps to light to dark red
   */
  private getOfficeColor(density: number): number {
    if (density === 0) {
      return LAND_COLOR; // No density = default land color
    }

    // Red gradient: from light red (low density) to dark red (high density)
    // RGB: light red (255, 182, 193) to dark red (139, 0, 0)
    const ratio = density / 99;
    const r = Math.floor(255 * (1 - ratio) + 200 * ratio);
    const g = Math.floor(182 * (1 - ratio) + 0 * ratio);
    const b = Math.floor(193 * (1 - ratio) + 0 * ratio);

    return (r << 16) | (g << 8) | b;
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
