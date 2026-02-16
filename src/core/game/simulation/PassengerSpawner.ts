/**
 * Passenger Spawning Logic for MetroMap.io
 */

import type { GameState } from "../models/GameState";
import type { MapGrid } from "../models/MapGrid";
import type { Station } from "../models/Station";
import { createPassenger } from "../models/Passenger";
import { findRoute } from "../pathfinding/StationGraph";
import { BASE_SPAWN_RATE } from "../config";

interface CatchmentStats {
  residential: number; // Total residential density score
  office: number; // Total office density score
}

// Cache for station catchment stats to avoid re-calculating every frame
const stationCatchmentCache = new Map<string, CatchmentStats>();

/**
 * Calculate the residential and office potential for a station
 * considering surrounding 16 squares (radius 2) and water blocking.
 */
function getStationCatchment(station: Station, map: MapGrid): CatchmentStats {
  if (stationCatchmentCache.has(station.id)) {
    return stationCatchmentCache.get(station.id)!;
  }

  let totalResidential = 0;
  let totalOffice = 0;

  // Station is at vertex (x, y). Surrounding tiles are defined by
  // x-2 to x+1, y-2 to y+1 relative to vertex.
  // Wait, vertex (x,y) is top-left of tile (x,y).
  // Vertex (vX, vY) touches tiles:
  // (vX-1, vY-1), (vX, vY-1), (vX-1, vY), (vX, vY)
  //
  // Radius 2 means we check tiles within range.
  // Let's perform a flood fill/BFS from the station vertex to find reachable land tiles.
  // We can treat vertices and tile centers as a graph?
  // Simpler: Check all tiles in range [vX-2, vX+1] x [vY-2, vY+1].
  // Check if they are reachable by "walking" along land tiles from the 4 central tiles.

  const startTiles = [
    { x: station.vertexX - 1, y: station.vertexY - 1 },
    { x: station.vertexX, y: station.vertexY - 1 },
    { x: station.vertexX - 1, y: station.vertexY },
    { x: station.vertexX, y: station.vertexY },
  ];

  const visited = new Set<string>();
  const queue: { x: number; y: number; dist: number }[] = [];

  // Initialize queue with valid adjacent land tiles
  for (const t of startTiles) {
    if (isValidLandTile(t.x, t.y, map)) {
      queue.push({ ...t, dist: 0 }); // Distance 0 from "center"
      visited.add(`${t.x},${t.y}`);
    }
  }

  // BFS to find all reachable tiles within radius
  // Note: "Radius 2 squares" implies max distance.
  // If we just flood fill max 2 steps from the center tiles?
  // Let's strictly limit to the bounding box [vX-2, vX+1] x [vY-2, vY+1]
  // and only sum connected land tiles.

  const minX = station.vertexX - 2;
  const maxX = station.vertexX + 1;
  const minY = station.vertexY - 2;
  const maxY = station.vertexY + 1;

  // Reset for flood fill within bounds
  visited.clear();
  // Re-initialize queue
  queue.length = 0;
  for (const t of startTiles) {
    if (
      t.x >= minX &&
      t.x <= maxX &&
      t.y >= minY &&
      t.y <= maxY &&
      isValidLandTile(t.x, t.y, map)
    ) {
      queue.push({ ...t, dist: 0 });
      visited.add(`${t.x},${t.y}`);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const tile = map.squares[current.y][current.x];

    // Add density contributions
    totalResidential += tile.homeDensity;
    totalOffice += tile.officeDensity;

    // Expand to neighbors
    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];

    for (const n of neighbors) {
      if (
        n.x >= minX &&
        n.x <= maxX &&
        n.y >= minY &&
        n.y <= maxY &&
        !visited.has(`${n.x},${n.y}`) &&
        isValidLandTile(n.x, n.y, map)
      ) {
        visited.add(`${n.x},${n.y}`);
        queue.push({ ...n, dist: current.dist + 1 });
      }
    }
  }

  const stats = { residential: totalResidential, office: totalOffice };
  stationCatchmentCache.set(station.id, stats);
  return stats;
}

function isValidLandTile(x: number, y: number, map: MapGrid): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  return map.squares[y][x].type === "LAND";
}

/**
 * Update passenger spawning for the game loop
 * @param gameState Current game state
 * @param deltaSeconds Time elapsed since last frame (real seconds)
 */
export function updatePassengerSpawning(
  gameState: GameState,
  deltaSeconds: number,
): void {
  // Clear cache if map changed (simple check: if cache empty but stations exist)
  if (gameState.stations.length > 0 && stationCatchmentCache.size === 0) {
    // Rebuild cache
    gameState.stations.forEach((s) => getStationCatchment(s, gameState.map));
  }

  const gameTimeDate = new Date(gameState.simulationTime);
  const hour = gameTimeDate.getHours();

  // Determine rush hour multipliers
  let isMorningRush = false;
  let isEveningRush = false;
  let spawnMultiplier = 1.0;

  if (hour >= 6 && hour < 10) {
    isMorningRush = true;
    spawnMultiplier = 3.0;
  } else if (hour >= 16 && hour < 20) {
    isEveningRush = true;
    spawnMultiplier = 3.0;
  } else if (hour >= 22 || hour < 5) {
    spawnMultiplier = 0.1; // Night
  }

  // Calculate potential "weights" for destination selection
  // We need global totals to normalize probabilities
  // BUT destination selection is relative to specific rider.
  // To optimize, let's pre-calculate a "Destination Weight" for every station for this frame.

  const stationDestWeights = new Map<string, number>();
  let totalDestWeight = 0;

  for (const station of gameState.stations) {
    const stats = getStationCatchment(station, gameState.map);
    let weight = 1; // Base weight

    if (isMorningRush) {
      // In morning, people go TO offices
      weight += stats.office * 2;
    } else if (isEveningRush) {
      // In evening, people go TO homes
      weight += stats.residential * 2;
    } else {
      // Balanced/Mixed
      weight += stats.residential + stats.office;
    }

    stationDestWeights.set(station.id, weight);
    totalDestWeight += weight;
  }

  // Process each station for spawning
  for (const station of gameState.stations) {
    const stats = getStationCatchment(station, gameState.map);

    // Calculate spawn probability for this station
    // Rate = Base * Multiplier * (Source Potential / Max Potential)
    // Source Potential depends on time
    let sourcePotential = 0;
    if (isMorningRush) {
      sourcePotential = stats.residential;
    } else if (isEveningRush) {
      sourcePotential = stats.office;
    } else {
      sourcePotential = (stats.residential + stats.office) * 0.5;
    }

    // Normalize potential (assuming max density ~100 * 16 squares = 1600)
    // Let's scale it so a dense area spawns frequently.
    // 50% density over 16 squares = 800.
    // We want e.g. 1 passenger per 2 seconds in busy station?
    // deltaSeconds is e.g. 0.016 (16ms) or more.
    // Let's use a probabilistic check.

    const densityFactor = sourcePotential / (100 * 100 * 25); // Tunable constant
    const spawnChance =
      (BASE_SPAWN_RATE * spawnMultiplier * densityFactor * deltaSeconds) / 3600;

    if (Math.random() < spawnChance) {
      spawnPassengerAt(station, gameState, stationDestWeights, totalDestWeight);
    }
  }
}

function spawnPassengerAt(
  sourceStation: Station,
  gameState: GameState,
  destWeights: Map<string, number>,
  totalDestWeight: number,
): void {
  // Select Destination
  // Simple roulette wheel selection
  // Ensure destination is NOT source (if possible)

  // Filter out source from weights conceptually (subtract source weight)
  const sourceWeight = destWeights.get(sourceStation.id) || 0;
  const adjustedTotalWeight = totalDestWeight - sourceWeight;

  if (adjustedTotalWeight <= 0) return; // Only one station or no weights?

  let randomVal = Math.random() * adjustedTotalWeight;
  let targetStationId = "";

  for (const s of gameState.stations) {
    if (s.id === sourceStation.id) continue;

    const weight = destWeights.get(s.id) || 0;
    randomVal -= weight;
    if (randomVal <= 0) {
      targetStationId = s.id;
      break;
    }
  }

  // Fallback if rounding errors (pick last valid)
  if (!targetStationId && gameState.stations.length > 1) {
    const other = gameState.stations.find((s) => s.id !== sourceStation.id);
    if (other) targetStationId = other.id;
  }

  if (!targetStationId) return;

  // Calculate Path
  const path = findRoute(
    sourceStation.id,
    targetStationId,
    gameState.stations,
    gameState.lines,
  );

  if (!path || path.length === 0) return;

  // Create Passenger
  const passenger = createPassenger(
    sourceStation.id,
    targetStationId,
    gameState.simulationTime,
  );
  passenger.path = path;
  // nextWaypointIndex starts at 0, which is the source station (path[0]).
  // We want the *next* station to target, which is path[1].
  passenger.nextWaypointIndex = 1;

  // Add to state
  gameState.passengers.push(passenger);
  sourceStation.passengers.push(passenger);

  // console.log(`Spawned pax at ${sourceStation.id} going to ${targetStationId}`);
}
