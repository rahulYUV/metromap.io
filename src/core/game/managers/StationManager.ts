/**
 * Station Manager for MetroMap.io
 * Handles all station-related logic extracted from screens.
 * Pure game logic with no rendering dependencies.
 */

import type { GameState } from "../models/GameState";
import type { Station } from "../models/Station";
import {
  generateStationId,
  generateStationLabel,
  createStation,
} from "../models/Station";
import { deductStationCost } from "../simulation/Economics";
import { saveGameState } from "../models/GameState";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: Station;
}

export class StationManager {
  constructor(private state: GameState) {}

  /**
   * Check if a station exists at the given vertex coordinates
   */
  hasStationAt(vertexX: number, vertexY: number): boolean {
    const stationId = generateStationId(vertexX, vertexY);
    return this.state.stations.some((s) => s.id === stationId);
  }

  /**
   * Check if any adjacent vertex (4-connected) has a station
   * This enforces minimum spacing rule
   */
  hasAdjacentStation(vertexX: number, vertexY: number): boolean {
    const adjacentVertices = [
      { x: vertexX - 1, y: vertexY },
      { x: vertexX + 1, y: vertexY },
      { x: vertexX, y: vertexY - 1 },
      { x: vertexX, y: vertexY + 1 },
    ];

    return adjacentVertices.some((v) => this.hasStationAt(v.x, v.y));
  }

  /**
   * Check if the vertex is on water
   */
  isWater(vertexX: number, vertexY: number): boolean {
    // A vertex is at the corner of 4 tiles. Check if ALL adjacent tiles are water.
    const adjacentTiles = [
      { x: vertexX - 1, y: vertexY - 1 },
      { x: vertexX, y: vertexY - 1 },
      { x: vertexX - 1, y: vertexY },
      { x: vertexX, y: vertexY },
    ];

    const { width, height, squares } = this.state.map;

    for (const tile of adjacentTiles) {
      // If tile is out of bounds or is land, vertex is not on water
      if (
        tile.x < 0 ||
        tile.x >= width ||
        tile.y < 0 ||
        tile.y >= height ||
        squares[tile.y][tile.x].type === "LAND"
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if vertex is on any land tile
   */
  isOnLand(vertexX: number, vertexY: number): boolean {
    // A vertex touches 4 tiles. Check if at least one is land.
    const adjacentTiles = [
      { x: vertexX - 1, y: vertexY - 1 },
      { x: vertexX, y: vertexY - 1 },
      { x: vertexX - 1, y: vertexY },
      { x: vertexX, y: vertexY },
    ];

    const { width, height, squares } = this.state.map;

    for (const tile of adjacentTiles) {
      if (
        tile.x >= 0 &&
        tile.x < width &&
        tile.y >= 0 &&
        tile.y < height &&
        squares[tile.y][tile.x].type === "LAND"
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate if a station can be placed at the given vertex
   */
  canPlaceStation(vertexX: number, vertexY: number): ValidationResult {
    // Check bounds
    if (vertexX < 0 || vertexX > this.state.map.width) {
      return { valid: false, reason: "X coordinate out of bounds" };
    }
    if (vertexY < 0 || vertexY > this.state.map.height) {
      return { valid: false, reason: "Y coordinate out of bounds" };
    }

    // Check if on water (vertex is surrounded by water tiles)
    if (this.isWater(vertexX, vertexY)) {
      return { valid: false, reason: "Cannot place station on water" };
    }

    // Check if station already exists
    if (this.hasStationAt(vertexX, vertexY)) {
      return {
        valid: false,
        reason: "Station already exists at this location",
      };
    }

    // Check adjacent spacing rule
    if (this.hasAdjacentStation(vertexX, vertexY)) {
      return {
        valid: false,
        reason: "Cannot place station adjacent to another station",
      };
    }

    return { valid: true };
  }

  /**
   * Place a station at the given vertex coordinates
   */
  placeStation(vertexX: number, vertexY: number): ActionResult {
    const validation = this.canPlaceStation(vertexX, vertexY);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Create the station
    const label = generateStationLabel(this.state.stations.length);
    const station = createStation(vertexX, vertexY, label);

    // Deduct cost
    deductStationCost(this.state);

    // Add to state
    this.state.stations.push(station);
    saveGameState(this.state);

    return { success: true, data: station };
  }

  /**
   * Remove a station by ID
   */
  removeStation(stationId: string): ActionResult {
    const index = this.state.stations.findIndex((s) => s.id === stationId);
    if (index === -1) {
      return { success: false, error: "Station not found" };
    }

    // Check if station is used by any line
    const usedByLine = this.state.lines.some((line) =>
      line.stationIds.includes(stationId),
    );
    if (usedByLine) {
      return {
        success: false,
        error: "Cannot remove station that is part of a line",
      };
    }

    // Remove station
    this.state.stations.splice(index, 1);
    saveGameState(this.state);

    return { success: true };
  }

  /**
   * Get a station by vertex coordinates
   */
  getStationAt(vertexX: number, vertexY: number): Station | undefined {
    const stationId = generateStationId(vertexX, vertexY);
    return this.state.stations.find((s) => s.id === stationId);
  }

  /**
   * Get a station by ID
   */
  getStationById(stationId: string): Station | undefined {
    return this.state.stations.find((s) => s.id === stationId);
  }

  /**
   * Get all stations
   */
  getAllStations(): Station[] {
    return this.state.stations;
  }
}
