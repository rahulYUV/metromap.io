/**
 * Game State model for MetroMap.io
 * Stores all information about the current game state
 */

import type { MapGrid } from "./MapGrid";
import type { Station } from "./Station";
import type { MetroLine, LineColor } from "./MetroLine";
import { storage } from "../../../engine/utils/storage";

const SAVE_GAME_KEY = "metromap-saved-game";

export interface GameState {
  seed: number;
  map: MapGrid;
  stations: Station[];
  lines: MetroLine[];
  // Future: trains, passengers, score, etc.
}

/**
 * Create a new empty game state
 */
export function createGameState(seed: number, map: MapGrid): GameState {
  return {
    seed,
    map,
    stations: [],
    lines: [],
  };
}

/**
 * Check if a line color already exists in the game state
 */
export function hasLineWithColor(state: GameState, color: LineColor): boolean {
  return state.lines.some((line) => line.color === color);
}

/**
 * Add a line to the game state with validation
 * Returns true if successful, false if color already exists
 */
export function addLine(state: GameState, line: MetroLine): boolean {
  // Guard against duplicate colors
  if (hasLineWithColor(state, line.color)) {
    console.warn(`Line with color ${line.color} already exists`);
    return false;
  }

  state.lines.push(line);
  saveGameState(state);
  return true;
}

/**
 * Add a station to the game state
 */
export function addStation(state: GameState, station: Station): void {
  state.stations.push(station);
  saveGameState(state);
}

/**
 * Save game state to localStorage
 */
export function saveGameState(state: GameState): void {
  storage.setObject(SAVE_GAME_KEY, state as unknown as Record<string, unknown>);
}

/**
 * Load game state from localStorage
 */
export function loadGameState(): GameState | null {
  const saved = storage.getObject(SAVE_GAME_KEY);
  if (!saved) return null;

  try {
    // Basic validation
    if (
      typeof saved === "object" &&
      saved !== null &&
      "seed" in saved &&
      "map" in saved &&
      "stations" in saved &&
      "lines" in saved
    ) {
      return saved as GameState;
    }
  } catch (e) {
    console.error("Failed to load saved game:", e);
  }

  return null;
}

/**
 * Clear saved game from localStorage
 */
export function clearSavedGame(): void {
  storage.setString(SAVE_GAME_KEY, "");
}

/**
 * Check if a saved game exists
 */
export function hasSavedGame(): boolean {
  return loadGameState() !== null;
}

/**
 * Serialize game state to JSON
 */
export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize game state from JSON
 */
export function deserializeGameState(json: string): GameState {
  return JSON.parse(json);
}
