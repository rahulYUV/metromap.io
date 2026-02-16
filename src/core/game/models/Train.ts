/**
 * Train data model for MetroMap.io
 */

import type { Passenger } from "./Passenger";
import type { LineSegment } from "../pathfinding/LinePath";
import { TRAIN_MAX_CAPACITY } from "../config";

export type TrainState = "MOVING" | "STOPPED";

export interface Train {
  id: string;
  lineId: string;
  state: TrainState;
  dwellRemaining: number;
  currentStationIdx: number;
  targetStationIdx: number;
  progress: number;
  direction: 1 | -1;
  currentSegment: LineSegment | null;
  totalLength: number;
  passengers: Passenger[];
  capacity: number;
}

/**
 * Create a new train
 */
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
    targetStationIdx: startStationIdx + 1,
    progress: 0,
    direction: 1,
    currentSegment: null,
    totalLength: 0,
    passengers: [],
    capacity: TRAIN_MAX_CAPACITY,
  };
}
