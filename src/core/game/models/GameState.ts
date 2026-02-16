/**
 * Game State model for MetroMap.io
 * Stores all information about the current game state
 */

import type { MapGrid } from "./MapGrid";
import type { Station } from "./Station";
import { generateStationLabel } from "./Station";
import type { MetroLine, LineColor } from "./MetroLine";
import type { Passenger } from "./Passenger";
import {
  GAME_START_TIME_ISO,
  STARTING_MONEY,
  STATION_BUILD_COST,
  LINE_BUILD_COST_PER_SQUARE,
} from "../config";

const SAVE_GAME_KEY = "metromap-saved-game";

export interface GameState {
  seed: number;
  map: MapGrid;
  stations: Station[];
  lines: MetroLine[];
  passengers: Passenger[];
  simulationTime: number;
  money: number;
  isPaused: boolean;
  speed: number;
}

/**
 * Create a new empty game state
 */
export function createGameState(seed: number, map: MapGrid): GameState {
  const startDate = new Date(GAME_START_TIME_ISO);
  return {
    seed,
    map,
    stations: [],
    lines: [],
    passengers: [],
    simulationTime: startDate.getTime(),
    money: STARTING_MONEY,
    isPaused: false,
    speed: 1,
  };
}

/**
 * Check if a line color already exists in the game state
 */
export function hasLineWithColor(state: GameState, color: LineColor): boolean {
  return state.lines.some((line) => line.color === color);
}

/**
 * Get a station by ID
 */
export function getStationById(
  state: GameState,
  stationId: string,
): Station | undefined {
  return state.stations.find((s) => s.id === stationId);
}

/**
 * Get a line by ID
 */
export function getLineById(
  state: GameState,
  lineId: string,
): MetroLine | undefined {
  return state.lines.find((l) => l.id === lineId);
}

/**
 * Calculate line length for cost calculation
 */
function calculateLineLength(line: MetroLine, state: GameState): number {
  if (line.stationIds.length < 2) return 0;

  let totalLength = 0;
  for (let i = 0; i < line.stationIds.length - 1; i++) {
    const fromStation = state.stations.find((s) => s.id === line.stationIds[i]);
    const toStation = state.stations.find(
      (s) => s.id === line.stationIds[i + 1],
    );
    if (fromStation && toStation) {
      const dx = toStation.vertexX - fromStation.vertexX;
      const dy = toStation.vertexY - fromStation.vertexY;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return totalLength;
}

/**
 * Add a line to the game state with cost deduction
 */
export function addLine(state: GameState, line: MetroLine): boolean {
  if (hasLineWithColor(state, line.color)) {
    return false;
  }

  // Deduct line build cost
  const lineLength = calculateLineLength(line, state);
  state.money -= lineLength * LINE_BUILD_COST_PER_SQUARE;

  state.lines.push(line);
  saveGameState(state);
  return true;
}

/**
 * Add a station to the game state with cost deduction
 */
export function addStation(state: GameState, station: Station): void {
  if (!station.label) {
    station.label = generateStationLabel(state.stations.length);
  }

  // Deduct station build cost
  state.money -= STATION_BUILD_COST;

  state.stations.push(station);
  saveGameState(state);
}

/**
 * Save game state to localStorage
 */
export function saveGameState(state: GameState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(SAVE_GAME_KEY, serialized);
  } catch (e) {
    console.error("Failed to save game state:", e);
  }
}

/**
 * Load game state from localStorage
 */
export function loadGameState(): GameState | null {
  try {
    const saved = localStorage.getItem(SAVE_GAME_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Basic validation
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "seed" in parsed &&
      "map" in parsed &&
      "stations" in parsed &&
      "lines" in parsed
    ) {
      // Ensure simulationTime exists
      if (!parsed.simulationTime || isNaN(parsed.simulationTime)) {
        const startDate = new Date(GAME_START_TIME_ISO);
        parsed.simulationTime = startDate.getTime();
      }

      // Ensure passengers array exists
      if (!parsed.passengers) {
        parsed.passengers = [];
      }

      // Ensure isPaused and speed exist
      if (parsed.isPaused === undefined) {
        parsed.isPaused = false;
      }
      if (parsed.speed === undefined) {
        parsed.speed = 1;
      }

      // Ensure each station has passengers array and label
      if (parsed.stations) {
        parsed.stations.forEach((station: Station, index: number) => {
          if (!station.passengers) {
            station.passengers = [];
          }
          if (!station.label) {
            station.label = generateStationLabel(index);
          }
        });
      }

      // Ensure money exists
      if (parsed.money === undefined || parsed.money === null) {
        parsed.money = STARTING_MONEY;
      }

      // Ensure each line has trains array
      if (parsed.lines) {
        parsed.lines.forEach((line: MetroLine) => {
          if (!line.trains) {
            line.trains = [];
          }
        });
      }

      return parsed as GameState;
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
  localStorage.removeItem(SAVE_GAME_KEY);
}

/**
 * Check if a saved game exists
 */
export function hasSavedGame(): boolean {
  return loadGameState() !== null;
}
