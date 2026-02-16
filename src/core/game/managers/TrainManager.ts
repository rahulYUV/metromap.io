/**
 * Train Manager for MetroMap.io
 * Handles all train-related logic extracted from screens.
 * Pure game logic with no rendering dependencies.
 */

import type { GameState } from "../models/GameState";
import type { MetroLine } from "../models/MetroLine";
import type { Train } from "../models/Train";
import { TRAIN_MAX_CAPACITY } from "../config";
import { saveGameState } from "../models/GameState";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: Train;
}

export class TrainManager {
  private static readonly MAX_TRAINS_PER_LINE = 5;

  constructor(private state: GameState) {}

  /**
   * Calculate the starting station index for a train
   * Based on train number and direction for optimal distribution
   */
  calculateStartStationIdx(
    trainNumber: number,
    direction: 1 | -1,
    stationCount: number,
  ): number {
    if (trainNumber <= 2) {
      // First two trains start at opposite ends
      return direction === 1 ? 0 : Math.max(stationCount - 1, 0);
    }

    // Trains 3+ start in the middle, distributed based on direction
    if (direction === 1) {
      return Math.floor(stationCount / 2);
    } else {
      return stationCount - 1 - Math.floor(stationCount / 2);
    }
  }

  /**
   * Create a train for a line with specific configuration
   */
  createTrainForLine(
    line: MetroLine,
    direction: 1 | -1,
    startStationIdx: number,
  ): Train {
    // Calculate target station index based on direction
    let targetStationIdx: number;
    if (direction === 1) {
      targetStationIdx = Math.min(
        startStationIdx + 1,
        line.stationIds.length - 1,
      );
    } else {
      targetStationIdx = Math.max(startStationIdx - 1, 0);
    }

    return {
      id: `train-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lineId: line.id,
      state: "MOVING",
      dwellRemaining: 0,
      currentStationIdx: startStationIdx,
      targetStationIdx,
      progress: 0,
      direction,
      currentSegment: null,
      totalLength: 0,
      passengers: [],
      capacity: TRAIN_MAX_CAPACITY,
    };
  }

  /**
   * Add a train to a line
   */
  addTrainToLine(lineId: string): ActionResult {
    const line = this.state.lines.find((l) => l.id === lineId);
    if (!line) {
      return { success: false, error: "Line not found" };
    }

    if (line.trains.length >= TrainManager.MAX_TRAINS_PER_LINE) {
      return { success: false, error: "Maximum trains reached for this line" };
    }

    if (line.stationIds.length < 2) {
      return { success: false, error: "Line needs at least 2 stations" };
    }

    // Calculate train number and direction
    const trainNumber = line.trains.length + 1;
    const direction: 1 | -1 = trainNumber % 2 === 1 ? 1 : -1;

    // Calculate starting position
    const startStationIdx = this.calculateStartStationIdx(
      trainNumber,
      direction,
      line.stationIds.length,
    );

    // Create and add train
    const train = this.createTrainForLine(line, direction, startStationIdx);
    line.trains.push(train);

    saveGameState(this.state);
    return { success: true, data: train };
  }

  /**
   * Remove a train from a line
   */
  removeTrainFromLine(lineId: string, trainId?: string): ActionResult {
    const line = this.state.lines.find((l) => l.id === lineId);
    if (!line) {
      return { success: false, error: "Line not found" };
    }

    if (line.trains.length <= 1) {
      return { success: false, error: "Must have at least one train per line" };
    }

    // Remove last train if no specific train ID provided
    if (!trainId) {
      line.trains.pop();
    } else {
      const index = line.trains.findIndex((t) => t.id === trainId);
      if (index === -1) {
        return { success: false, error: "Train not found" };
      }
      line.trains.splice(index, 1);
    }

    saveGameState(this.state);
    return { success: true };
  }

  /**
   * Get train count for a line
   */
  getTrainCount(lineId: string): number {
    const line = this.state.lines.find((l) => l.id === lineId);
    return line?.trains.length ?? 0;
  }

  /**
   * Check if can add more trains to a line
   */
  canAddTrain(lineId: string): boolean {
    const line = this.state.lines.find((l) => l.id === lineId);
    if (!line) return false;
    return line.trains.length < TrainManager.MAX_TRAINS_PER_LINE;
  }

  /**
   * Check if can remove trains from a line
   */
  canRemoveTrain(lineId: string): boolean {
    const line = this.state.lines.find((l) => l.id === lineId);
    if (!line) return false;
    return line.trains.length > 1;
  }

  /**
   * Get all trains on a line
   */
  getTrainsForLine(lineId: string): Train[] {
    const line = this.state.lines.find((l) => l.id === lineId);
    return line?.trains ?? [];
  }
}
