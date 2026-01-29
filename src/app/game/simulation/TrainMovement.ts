/**
 * Train Movement Logic for MetroMap.io
 * Handles train initialization, movement, and path calculation
 */

import type { GameState } from "../models/GameState";
import type { Train } from "../models/Train";
import type { MetroLine } from "../models/MetroLine";
import { createTrain } from "../models/Train";
import {
  TRAIN_DEFAULT_SPEED,
  TRAIN_STOP_DURATION_SQUARES,
  TRAIN_ACCEL_DECEL_DISTANCE,
} from "../config";
import {
  calculateSegmentPath,
  calculateSnapAngle,
  Direction,
  type LineSegment,
} from "../pathfinding/LinePath";
import { updatePassengerMovement } from "./PassengerMovement";
import { deductTrainRunningCost } from "./Economics";

/**
 * Initialize trains on lines that don't have them
 */
export function initializeTrains(gameState: GameState): void {
  for (const line of gameState.lines) {
    if (!line.trains || line.trains.length === 0) {
      line.trains = [];
      // Add one train per line
      const train = createTrain(line.id, 0); // Start at first station

      // Initial path calculation
      updateTrainPath(train, line, gameState);

      line.trains.push(train);
    } else {
      // Ensure existing trains have paths (e.g. after reload)
      for (const train of line.trains) {
        // Ensure passengers array exists (for backward compatibility)
        if (!train.passengers) {
          train.passengers = [];
        }
        if (!train.currentSegment) {
          updateTrainPath(train, line, gameState);
        }
      }
    }
  }
}

/**
 * Update trains movement
 */
export function updateTrains(gameState: GameState, deltaSeconds: number): void {
  for (const line of gameState.lines) {
    if (!line.trains) continue;

    for (const train of line.trains) {
      // Migration/Safety initialization
      if (!train.state) {
        train.state = "MOVING";
        train.dwellRemaining = 0;
      }

      if (!train.currentSegment) {
        updateTrainPath(train, line, gameState);
        if (!train.currentSegment) continue; // Should not happen unless line invalid
      }

      // Handle STOPPED state (Dwell time)
      if (train.state === "STOPPED") {
        // Decrease dwell time "distance" based on default speed
        // This ensures stop time scales with game speed and configuration
        const dwellDecrease = TRAIN_DEFAULT_SPEED * deltaSeconds;
        train.dwellRemaining -= dwellDecrease;

        if (train.dwellRemaining <= 0) {
          train.state = "MOVING";
          train.dwellRemaining = 0;
          // Proceed to acceleration immediately in this frame?
          // Fall through to moving logic?
          // Ideally yes, but for simplicity let's wait next frame or fall through.
          // Let's fall through to allow instant start.
        } else {
          continue; // Still stopped
        }
      }

      // Handle MOVING state
      if (train.state === "MOVING") {
        const distTotal = train.totalLength;
        const distCovered = train.progress * distTotal;
        const distRemaining = distTotal - distCovered;

        // Acceleration/Deceleration Logic
        let speedFactor = 1.0;

        // Accelerate when leaving previous station
        if (distCovered < TRAIN_ACCEL_DECEL_DISTANCE) {
          // Ramp from 0 to 1. Use max(0.1) to ensure movement.
          const accelFactor = Math.max(
            0.1,
            distCovered / TRAIN_ACCEL_DECEL_DISTANCE,
          );
          speedFactor = Math.min(speedFactor, accelFactor);
        }

        // Decelerate when approaching next station
        if (distRemaining < TRAIN_ACCEL_DECEL_DISTANCE) {
          const decelFactor = Math.max(
            0.1,
            distRemaining / TRAIN_ACCEL_DECEL_DISTANCE,
          );
          speedFactor = Math.min(speedFactor, decelFactor);
        }

        // Calculate movement distance
        const currentSpeed = TRAIN_DEFAULT_SPEED * speedFactor;
        const moveDist = currentSpeed * deltaSeconds;

        // Deduct running cost for distance traveled
        deductTrainRunningCost(gameState, moveDist);

        // Avoid division by zero for zero-length segments
        const progressIncrement =
          train.totalLength > 0 ? moveDist / train.totalLength : 1;

        train.progress += progressIncrement;

        // Check if reached destination
        if (train.progress >= 1.0) {
          // Arrived at station -> SWITCH TO STOPPED STATE

          // Snap to end
          train.currentStationIdx = train.targetStationIdx;
          train.progress = 0; // Reset progress for next segment

          // Set state to stopped
          train.state = "STOPPED";
          train.dwellRemaining = TRAIN_STOP_DURATION_SQUARES;

          // Determine next target and direction BEFORE passenger boarding
          // This ensures passengers see the correct direction when deciding to board
          if (line.isLoop) {
            // Circular movement
            if (train.direction === 1) {
              train.targetStationIdx =
                (train.currentStationIdx + 1) % line.stationIds.length;
            } else {
              train.targetStationIdx =
                (train.currentStationIdx - 1 + line.stationIds.length) %
                line.stationIds.length;
            }
          } else {
            // Linear movement
            if (train.direction === 1) {
              if (train.currentStationIdx >= line.stationIds.length - 1) {
                // Reached end, reverse
                train.direction = -1;
                train.targetStationIdx = train.currentStationIdx - 1;
              } else {
                train.targetStationIdx = train.currentStationIdx + 1;
              }
            } else {
              if (train.currentStationIdx <= 0) {
                // Reached start, reverse
                train.direction = 1;
                train.targetStationIdx = train.currentStationIdx + 1;
              } else {
                train.targetStationIdx = train.currentStationIdx - 1;
              }
            }
          }

          // Handle passenger boarding and alighting AFTER direction is set
          const currentStationId = line.stationIds[train.currentStationIdx];
          const currentStation = gameState.stations.find(
            (s) => s.id === currentStationId,
          );
          if (currentStation) {
            updatePassengerMovement(train, currentStation, gameState);
          }

          // Calculate new path for the NEXT segment
          updateTrainPath(train, line, gameState);
        }
      }
    }
  }
}

/**
 * Calculate and cache path for a train's next segment
 */
export function updateTrainPath(
  train: Train,
  line: MetroLine,
  gameState: GameState,
): void {
  const idxA = train.currentStationIdx;
  const idxB = train.targetStationIdx;

  const fromId = line.stationIds[idxA];
  const toId = line.stationIds[idxB];

  const stationA = gameState.stations.find((s) => s.id === fromId);
  const stationB = gameState.stations.find((s) => s.id === toId);

  if (!stationA || !stationB) return;

  // Handle zero-distance segments (e.g. wrap-around on loops where start==end)
  if (stationA.id === stationB.id) {
    train.currentSegment = {
      fromStation: stationA,
      toStation: stationB,
      entryAngle: Direction.EAST,
      exitAngle: Direction.EAST,
      waypoints: [
        { x: stationA.vertexX, y: stationA.vertexY, type: "STATION" },
      ],
    };
    train.totalLength = 0;
    return;
  }

  // To ensure the train follows the exact path drawn on screen,
  // we must calculate the path in the "canonical" direction (increasing index)
  // as that's how the line was built and rendered.
  // If the train is moving backwards, we calculate the forward path and reverse it.

  const minIdx = Math.min(idxA, idxB);
  const maxIdx = Math.max(idxA, idxB);

  const canonicalFromId = line.stationIds[minIdx];
  const canonicalToId = line.stationIds[maxIdx];

  const canonicalFrom = gameState.stations.find(
    (s) => s.id === canonicalFromId,
  )!;
  const canonicalTo = gameState.stations.find((s) => s.id === canonicalToId)!;

  // Determine "next" angle for optimization, matching MetroBuildingScreen logic
  // We look at the station *after* the segment end to smooth the corner
  let nextAngle: Direction | null = null;
  if (maxIdx + 1 < line.stationIds.length) {
    const nextNextId = line.stationIds[maxIdx + 1];
    const nextNextStation = gameState.stations.find((s) => s.id === nextNextId);
    if (nextNextStation) {
      nextAngle = calculateSnapAngle(canonicalTo, nextNextStation);
    }
  }

  // Calculate the canonical path
  const segment = calculateSegmentPath(canonicalFrom, canonicalTo, nextAngle);

  // If train is moving backwards relative to line definition, reverse waypoints
  if (idxA > idxB) {
    segment.waypoints.reverse();
  }

  train.currentSegment = segment;
  train.totalLength = calculateSegmentLength(segment);
}

/**
 * Calculate total length of a segment in grid units
 */
export function calculateSegmentLength(segment: LineSegment): number {
  let length = 0;
  const waypoints = segment.waypoints;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
