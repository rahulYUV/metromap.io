/**
 * Economic System for MetroMap.io
 * Handles all money-related operations: building costs, running costs, and revenue
 */

import type { GameState } from "../models/GameState";
import type { MetroLine } from "../models/MetroLine";
import {
  STATION_BUILD_COST,
  LINE_BUILD_COST_PER_SQUARE,
  TRAIN_RUNNING_COST_PER_SQUARE,
  TICKET_REVENUE,
} from "../config";

/**
 * Calculate the total length of a metro line in grid squares
 */
export function calculateLineLength(
  line: MetroLine,
  gameState: GameState,
): number {
  if (line.stationIds.length < 2) {
    return 0;
  }

  let totalLength = 0;

  for (let i = 0; i < line.stationIds.length - 1; i++) {
    const fromStationId = line.stationIds[i];
    const toStationId = line.stationIds[i + 1];

    const fromStation = gameState.stations.find((s) => s.id === fromStationId);
    const toStation = gameState.stations.find((s) => s.id === toStationId);

    if (fromStation && toStation) {
      const dx = toStation.vertexX - fromStation.vertexX;
      const dy = toStation.vertexY - fromStation.vertexY;
      // Calculate Euclidean distance (allows diagonal segments)
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalLength += distance;
    }
  }

  return totalLength;
}

/**
 * Deduct the cost of building a station from game money
 */
export function deductStationCost(gameState: GameState): void {
  gameState.money -= STATION_BUILD_COST;
}

/**
 * Deduct the cost of building a line from game money
 */
export function deductLineCost(gameState: GameState, line: MetroLine): void {
  const lineLength = calculateLineLength(line, gameState);
  const lineCost = lineLength * LINE_BUILD_COST_PER_SQUARE;
  gameState.money -= lineCost;
}

/**
 * Deduct the running cost of a train traveling a certain distance
 */
export function deductTrainRunningCost(
  gameState: GameState,
  distanceTraveled: number,
): void {
  const runningCost = distanceTraveled * TRAIN_RUNNING_COST_PER_SQUARE;
  gameState.money -= runningCost;
}

/**
 * Add revenue from a completed passenger journey
 */
export function addTicketRevenue(gameState: GameState): void {
  gameState.money += TICKET_REVENUE;
}

/**
 * Format money for display with $ sign and appropriate color
 * Returns an object with formatted text and color
 */
export function formatMoney(money: number): { text: string; color: number } {
  const formattedAmount = Math.abs(money).toFixed(0);
  const text = money >= 0 ? `$${formattedAmount}` : `-$${formattedAmount}`;
  const color = money >= 0 ? 0x00ff00 : 0xff0000; // Green for positive, red for negative

  return { text, color };
}
