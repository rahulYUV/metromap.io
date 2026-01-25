import type { LineSegment } from "../pathfinding/LinePath";

export interface Train {
  id: string;
  lineId: string;

  // Position state
  currentStationIdx: number; // Index in line.stationIds
  targetStationIdx: number; // Index in line.stationIds
  progress: number; // 0 to 1 along the current segment

  // Movement state
  direction: 1 | -1; // 1 = forward (index increasing), -1 = backward
  speed: number; // grid squares per second

  // Cached path data for current segment (Station A -> Station B)
  currentSegment: LineSegment | null;
  totalLength: number; // Length of current segment in grid units
}

export function createTrain(
  lineId: string,
  startStationIdx: number = 0,
  speed: number = 1,
): Train {
  return {
    id: `train-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    lineId,
    currentStationIdx: startStationIdx,
    targetStationIdx: startStationIdx + 1, // Will be fixed by logic if invalid
    progress: 0,
    direction: 1,
    speed,
    currentSegment: null,
    totalLength: 0,
  };
}
