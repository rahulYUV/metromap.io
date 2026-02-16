/**
 * Core type definitions for MetroMap.io
 * These types are shared between the game logic and rendering layers.
 */

// ============================================================================
// Basic Types
// ============================================================================

export interface Vector2 {
  x: number;
  y: number;
}

// ============================================================================
// Action Types
// ============================================================================

export type GameActionType =
  | "PLACE_STATION"
  | "REMOVE_STATION"
  | "START_LINE"
  | "ADD_STATION_TO_LINE"
  | "COMPLETE_LINE"
  | "CANCEL_LINE"
  | "ADD_TRAIN"
  | "REMOVE_TRAIN"
  | "PAUSE"
  | "RESUME"
  | "SET_SPEED";

export interface GameAction {
  type: GameActionType;
  payload?: unknown;
}

// ============================================================================
// Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// ============================================================================
// Visualization Types
// ============================================================================

export type VisualizationMode = "DEFAULT" | "RESIDENTIAL" | "OFFICE" | "BOTH";

// Re-export types from models
export type { LineColor } from "../game/models/MetroLine";

export type SimulationSpeed = 1 | 2 | 4;
