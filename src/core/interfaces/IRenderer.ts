/**
 * Renderer Interface for MetroMap.io
 * Defines the contract that any rendering implementation must fulfill.
 * This abstraction allows swapping renderers (PixiJS, React Native, etc.)
 * without affecting game logic.
 */

import type { MapGrid, GameState } from "../game/models";
import type { VisualizationMode, Vector2 } from "./types";

/**
 * Renderable data structures (pure data, no methods)
 * These are passed to the renderer for visualization
 */
export interface RenderableMap {
  grid: MapGrid;
}

export interface RenderableStation {
  id: string;
  position: Vector2;
  label: string;
  passengerCount: number;
}

export interface RenderableLine {
  id: string;
  color: string;
  stationIds: string[];
  stations: Vector2[];
  isLoop: boolean;
}

export interface RenderableTrain {
  id: string;
  lineId: string;
  position: Vector2;
  progress: number;
  passengerCount: number;
  capacity: number;
  direction: 1 | -1;
}

/**
 * Callback types for user interactions
 */
export type MapClickCallback = (vertexX: number, vertexY: number) => void;
export type StationClickCallback = (stationId: string) => void;

/**
 * Main Renderer Interface
 */
export interface IRenderer {
  // Lifecycle
  initialize(): Promise<void>;
  destroy(): void;

  // Map rendering
  renderMap(map: RenderableMap): void;
  setVisualizationMode(mode: VisualizationMode): void;
  getVisualizationMode(): VisualizationMode;

  // Metro rendering
  renderStations(stations: RenderableStation[]): void;
  renderLines(lines: RenderableLine[], tempLine?: RenderableLine | null): void;
  renderTrains(trains: RenderableTrain[]): void;
  renderMetro(state: GameState): void;

  // Interaction callbacks
  onMapClick(callback: MapClickCallback): void;
  onStationClick(callback: StationClickCallback): void;
  clearCallbacks(): void;

  // Dimensions
  getMapDimensions(): { width: number; height: number };
  getTileSize(): number;

  // Utility
  screenToVertex(screenX: number, screenY: number): Vector2;
  vertexToScreen(vertexX: number, vertexY: number): Vector2;
  clear(): void;
}

/**
 * Renderer factory function type
 */
export type RendererFactory = () => IRenderer;
