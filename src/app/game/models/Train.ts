import type { LineSegment } from "../pathfinding/LinePath";
import type { Passenger } from "./Passenger";
import { TRAIN_MAX_CAPACITY } from "../config";

// Train capacity constant
export { TRAIN_MAX_CAPACITY };

export type TrainState = "MOVING" | "STOPPED";

export interface Train {
  id: string;
  lineId: string;

  state: TrainState;
  dwellRemaining: number; // Remaining dwell "distance" (virtual distance units)

  // Position state

  // Position state
  currentStationIdx: number; // Index in line.stationIds
  targetStationIdx: number; // Index in line.stationIds
  progress: number; // 0 to 1 along the current segment

  // Movement state
  direction: 1 | -1; // 1 = forward (index increasing), -1 = backward
  // Speed is now read from config at runtime

  // Cached path data for current segment (Station A -> Station B)
  currentSegment: LineSegment | null;
  totalLength: number; // Length of current segment in grid units

  // Passengers
  passengers: Passenger[];
  capacity: number;
}

export function createTrain(
  lineId: string,
  startStationIdx: number = 0,
): Train {
  return {
    id: `train-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    lineId,
    state: "MOVING",
    dwellRemaining: 0,
    currentStationIdx: startStationIdx,
    targetStationIdx: startStationIdx + 1, // Will be fixed by logic if invalid
    progress: 0,
    direction: 1,
    currentSegment: null,
    totalLength: 0,
    passengers: [],
    capacity: TRAIN_MAX_CAPACITY,
  };
}
