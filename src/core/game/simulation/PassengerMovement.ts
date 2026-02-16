/**
 * Passenger Movement Logic for MetroMap.io
 * Handles passenger boarding, traveling, and alighting from trains
 */

import type { GameState } from "../models/GameState";
import type { Train } from "../models/Train";
import type { Station } from "../models/Station";
import type { Passenger } from "../models/Passenger";
import type { MetroLine } from "../models/MetroLine";
import { TRAIN_MAX_CAPACITY } from "../config";
import { addTicketRevenue } from "./Economics";

/**
 * Check if a train is traveling towards a specific station
 * Returns true if the target station is ahead in the train's current direction
 */
function isTrainHeadingTowards(
  train: Train,
  targetStationId: string,
  line: MetroLine,
): boolean {
  const targetIdx = line.stationIds.indexOf(targetStationId);
  if (targetIdx === -1) return false; // Station not on this line

  const currentIdx = train.currentStationIdx;

  if (train.direction === 1) {
    // Moving forward (increasing index)
    return targetIdx > currentIdx;
  } else {
    // Moving backward (decreasing index)
    return targetIdx < currentIdx;
  }
}

/**
 * Get the line that connects two stations in a passenger's path
 * Returns the line ID if found, null otherwise
 */
function getLineConnectingStations(
  fromStationId: string,
  toStationId: string,
  lines: MetroLine[],
): string | null {
  for (const line of lines) {
    const fromIdx = line.stationIds.indexOf(fromStationId);
    const toIdx = line.stationIds.indexOf(toStationId);

    // Both stations must be on the line (don't need to be adjacent)
    if (fromIdx !== -1 && toIdx !== -1) {
      return line.id;
    }
  }
  return null;
}

/**
 * Handle passenger boarding at a station when a train arrives
 */
export function handlePassengerBoarding(
  station: Station,
  train: Train,
  gameState: GameState,
): void {
  const line = gameState.lines.find((l) => l.id === train.lineId);
  if (!line) return;

  // Ensure train has passengers array initialized
  if (!train.passengers) {
    train.passengers = [];
  }

  // Get passengers waiting at this station
  const waitingPassengers = station.passengers.filter(
    (p) => p.currentStationId === station.id && !p.currentTrainId,
  );

  // Try to board passengers until train is full
  for (const passenger of waitingPassengers) {
    if (train.passengers.length >= TRAIN_MAX_CAPACITY) {
      break; // Train is full
    }

    // Check if passenger wants to board this train
    if (shouldPassengerBoard(passenger, train, line, gameState)) {
      // Board the passenger
      passenger.currentStationId = undefined;
      passenger.currentTrainId = train.id;
      train.passengers.push(passenger);

      // Remove from station queue
      const idx = station.passengers.indexOf(passenger);
      if (idx !== -1) {
        station.passengers.splice(idx, 1);
      }
    }
  }
}

/**
 * Determine if a passenger should board a specific train
 * Passenger boards if:
 * 1. The train is heading towards their next waypoint, OR
 * 2. The train is heading towards their final destination
 */
function shouldPassengerBoard(
  passenger: Passenger,
  train: Train,
  line: MetroLine,
  gameState: GameState,
): boolean {
  // Get passenger's next waypoint
  const nextWaypointId = passenger.path[passenger.nextWaypointIndex];
  if (!nextWaypointId) return false; // No valid waypoint

  // Check if this line can take the passenger towards their next waypoint
  const currentStationId = passenger.currentStationId;
  if (!currentStationId) return false;

  // Get the line that connects current station to next waypoint
  const requiredLineId = getLineConnectingStations(
    currentStationId,
    nextWaypointId,
    gameState.lines,
  );

  // If this train's line doesn't connect to next waypoint, don't board
  if (requiredLineId !== line.id) return false;

  // Check if train is heading in the right direction
  return isTrainHeadingTowards(train, nextWaypointId, line);
}

/**
 * Handle passengers alighting when train reaches a station
 */
export function handlePassengerAlighting(
  station: Station,
  train: Train,
  gameState: GameState,
): void {
  // Ensure train has passengers array initialized
  if (!train.passengers) {
    train.passengers = [];
    return; // No passengers to alight
  }

  const passengersToAlight: Passenger[] = [];

  // Check each passenger on the train
  for (const passenger of train.passengers) {
    const nextWaypointId = passenger.path[passenger.nextWaypointIndex];

    // Passenger should alight if this station is their next waypoint
    if (nextWaypointId === station.id) {
      passengersToAlight.push(passenger);
    }
  }

  // Alight passengers
  for (const passenger of passengersToAlight) {
    // Remove from train
    const trainIdx = train.passengers.indexOf(passenger);
    if (trainIdx !== -1) {
      train.passengers.splice(trainIdx, 1);
    }

    passenger.currentTrainId = undefined;

    // Check if this is the final destination
    if (station.id === passenger.destinationStationId) {
      // Passenger has completed their journey
      completePassengerJourney(passenger, gameState);
    } else {
      // Passenger is transferring - wait at this station for next train
      passenger.currentStationId = station.id;
      passenger.nextWaypointIndex++; // Move to next waypoint in path
      station.passengers.push(passenger);
    }
  }
}

/**
 * Complete a passenger's journey (remove from game state)
 */
function completePassengerJourney(
  passenger: Passenger,
  gameState: GameState,
): void {
  // Remove passenger from global state
  const idx = gameState.passengers.indexOf(passenger);
  if (idx !== -1) {
    gameState.passengers.splice(idx, 1);
  }

  // Safety check: Ensure passenger is not in any station queue
  // (shouldn't happen with correct logic, but defensive programming)
  for (const station of gameState.stations) {
    const stationIdx = station.passengers.indexOf(passenger);
    if (stationIdx !== -1) {
      station.passengers.splice(stationIdx, 1);
      console.warn(
        `Cleaned up completed passenger ${passenger.id} from station ${station.id}`,
      );
    }
  }

  // Clear passenger state
  passenger.currentStationId = undefined;
  passenger.currentTrainId = undefined;

  // Add ticket revenue for completed journey
  addTicketRevenue(gameState);

  // Future: Update score, statistics, etc.
  // console.log(`Passenger ${passenger.id} completed journey from ${passenger.sourceStationId} to ${passenger.destinationStationId}`);
}

/**
 * Update passenger movements when trains arrive at stations
 * Call this when a train reaches a station (progress >= 1.0)
 */
export function updatePassengerMovement(
  train: Train,
  station: Station,
  gameState: GameState,
): void {
  // First: Handle alighting (passengers getting off)
  handlePassengerAlighting(station, train, gameState);

  // Second: Handle boarding (passengers getting on)
  handlePassengerBoarding(station, train, gameState);
}
