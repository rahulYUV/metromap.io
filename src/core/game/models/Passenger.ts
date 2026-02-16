/**
 * Passenger data model for MetroMap.io
 */

export interface Passenger {
  id: string;
  sourceStationId: string;
  destinationStationId: string;
  spawnTime: number;
  path: string[];
  nextWaypointIndex: number;
  currentStationId?: string;
  currentTrainId?: string;
}

/**
 * Create a new passenger
 */
export function createPassenger(
  sourceId: string,
  destinationId: string,
  spawnTime: number,
): Passenger {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    sourceStationId: sourceId,
    destinationStationId: destinationId,
    spawnTime,
    path: [],
    nextWaypointIndex: 0,
    currentStationId: sourceId,
  };
}
