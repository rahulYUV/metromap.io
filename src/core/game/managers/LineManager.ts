/**
 * Line Manager for MetroMap.io
 * Handles all metro line-related logic extracted from screens.
 * Pure game logic with no rendering dependencies.
 */

import type { GameState } from "../models/GameState";
import type { MetroLine, LineColor } from "../models/MetroLine";
import {
  isLineLoop,
  canAddStationToLine,
  createLine,
  LINE_COLORS,
} from "../models/MetroLine";
import { hasLineWithColor } from "../models/GameState";

export interface LineActionResult {
  success: boolean;
  error?: string;
  data?: MetroLine;
}

/**
 * State for a line being built
 */
export interface BuildingLine {
  color: LineColor | null;
  stationIds: string[];
}

export class LineManager {
  private currentLine: BuildingLine | null = null;

  constructor(private state: GameState) {}

  /**
   * Check if currently building a line
   */
  isBuilding(): boolean {
    return this.currentLine !== null;
  }

  /**
   * Get the current line being built
   */
  getCurrentLine(): BuildingLine | null {
    return this.currentLine;
  }

  /**
   * Get available (unused) line colors
   */
  getAvailableColors(): LineColor[] {
    return LINE_COLORS.filter((color) => !hasLineWithColor(this.state, color));
  }

  /**
   * Start building a new line
   */
  startLine(color: LineColor): LineActionResult {
    // Check if color is already used
    if (hasLineWithColor(this.state, color)) {
      return {
        success: false,
        error: `Line with color ${color} already exists`,
      };
    }

    this.currentLine = {
      color,
      stationIds: [],
    };

    return { success: true };
  }

  /**
   * Add a station to the current line being built
   */
  addStationToLine(stationId: string): LineActionResult {
    if (!this.currentLine) {
      return { success: false, error: "No line is being built" };
    }

    if (!this.currentLine.color) {
      return { success: false, error: "Line color not selected" };
    }

    // Validate station exists
    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) {
      return { success: false, error: "Station not found" };
    }

    // Check if can add station
    if (!canAddStationToLine(this.currentLine.stationIds, stationId)) {
      return { success: false, error: "Cannot add this station to the line" };
    }

    this.currentLine.stationIds.push(stationId);
    return { success: true };
  }

  /**
   * Cancel the current line being built
   */
  cancelLine(): void {
    this.currentLine = null;
  }

  /**
   * Complete the current line and add it to the game state
   */
  completeLine(): LineActionResult {
    if (!this.currentLine || !this.currentLine.color) {
      return { success: false, error: "No line is being built" };
    }

    if (this.currentLine.stationIds.length < 2) {
      return { success: false, error: "Line must have at least 2 stations" };
    }

    // Check for loop
    const isLoop = isLineLoop(this.currentLine.stationIds);

    // Create the line
    const line = createLine(
      this.currentLine.color,
      this.currentLine.stationIds,
      isLoop,
    );

    // Add to state (deduct costs will be handled separately)
    this.state.lines.push(line);

    // Clear current line
    this.currentLine = null;

    return { success: true, data: line };
  }

  /**
   * Get a line by ID
   */
  getLineById(lineId: string): MetroLine | undefined {
    return this.state.lines.find((l) => l.id === lineId);
  }

  /**
   * Get all lines
   */
  getAllLines(): MetroLine[] {
    return this.state.lines;
  }

  /**
   * Get lines that include a specific station
   */
  getLinesForStation(stationId: string): MetroLine[] {
    return this.state.lines.filter((line) =>
      line.stationIds.includes(stationId),
    );
  }
}
