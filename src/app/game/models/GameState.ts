/**
 * Game State model for MetroMap.io
 * Stores all information about the current game state
 */

import type { MapGrid } from "./MapGrid";
import type { Station } from "./Station";
import type { MetroLine, LineColor } from "./MetroLine";
import type { Passenger } from "./Passenger";
import { storage } from "../../../engine/utils/storage";

const SAVE_GAME_KEY = "metromap-saved-game";

export interface GameState {
  seed: number;
  map: MapGrid;
  stations: Station[];
  lines: MetroLine[];
  passengers: Passenger[]; // Active passengers in the system (waiting or traveling)
  simulationTime: number; // Unix timestamp in milliseconds
  // Future: trains, passengers, score, etc.
}

/**
 * Create a new empty game state
 */
export function createGameState(seed: number, map: MapGrid): GameState {
  // Start at 1 Jan 2025 08:00
  const startDate = new Date("2025-01-01T08:00:00");
  return {
    seed,
    map,
    stations: [],
    lines: [],
    passengers: [],
    simulationTime: startDate.getTime(),
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
      const gameState = saved as GameState;

      // Ensure simulationTime exists (for backward compatibility)
      if (!gameState.simulationTime || isNaN(gameState.simulationTime)) {
        const startDate = new Date("2025-01-01T08:00:00");
        gameState.simulationTime = startDate.getTime();
      }

      // Ensure passengers array exists (for backward compatibility)
      if (!gameState.passengers) {
        gameState.passengers = [];
      }

      // Ensure each station has a passengers array (for backward compatibility)
      if (gameState.stations) {
        gameState.stations.forEach((station) => {
          if (!station.passengers) {
            station.passengers = [];
          }
        });
      }

      return gameState;
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
