/**
 * Harry Beck style pathfinding for metro lines
 * Uses Octilinear Routing with Corner Filleting
 *
 * Lines are restricted to three angles: horizontal, vertical, and 45° diagonal
 * Bends are created at "knee" points where direction changes
 */

import type { Station } from "../models/Station";

export enum Direction {
  EAST = 0, // 0°
  SOUTHEAST = 45, // 45°
  SOUTH = 90, // 90°
  SOUTHWEST = 135, // 135°
  WEST = 180, // 180°
  NORTHWEST = 225, // 225°
  NORTH = 270, // 270°
  NORTHEAST = 315, // 315°
}

export interface DirectionVector {
  dx: number;
  dy: number;
}

export const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  [Direction.EAST]: { dx: 1, dy: 0 },
  [Direction.SOUTHEAST]: { dx: 1, dy: 1 },
  [Direction.SOUTH]: { dx: 0, dy: 1 },
  [Direction.SOUTHWEST]: { dx: -1, dy: 1 },
  [Direction.WEST]: { dx: -1, dy: 0 },
  [Direction.NORTHWEST]: { dx: -1, dy: -1 },
  [Direction.NORTH]: { dx: 0, dy: -1 },
  [Direction.NORTHEAST]: { dx: 1, dy: -1 },
};

export interface Waypoint {
  x: number;
  y: number;
  type: "STATION" | "BEND";
  incomingAngle?: Direction;
  outgoingAngle?: Direction;
}

export interface LineSegment {
  fromStation: Station;
  toStation: Station;
  entryAngle: Direction;
  exitAngle: Direction;
  waypoints: Waypoint[];
}

/**
 * Create a normalized segment key from two station IDs
 * The key is the same regardless of direction (A->B === B->A)
 */
export function createSegmentKey(
  stationId1: string,
  stationId2: string,
): string {
  return [stationId1, stationId2].sort().join("-");
}

/**
 * Determine the primary orientation of a segment
 * Used to decide offset direction for parallel lines
 */
export function getSegmentOrientation(
  dx: number,
  dy: number,
): "HORIZONTAL" | "VERTICAL" | "DIAGONAL" {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy) return "HORIZONTAL";
  if (absDy > absDx) return "VERTICAL";
  return "DIAGONAL";
}

/**
 * Get direction enum from dx/dy signs
 */
function getDirection(dx: number, dy: number): Direction {
  if (dx > 0 && dy === 0) return Direction.EAST;
  if (dx > 0 && dy > 0) return Direction.SOUTHEAST;
  if (dx === 0 && dy > 0) return Direction.SOUTH;
  if (dx < 0 && dy > 0) return Direction.SOUTHWEST;
  if (dx < 0 && dy === 0) return Direction.WEST;
  if (dx < 0 && dy < 0) return Direction.NORTHWEST;
  if (dx === 0 && dy < 0) return Direction.NORTH;
  if (dx > 0 && dy < 0) return Direction.NORTHEAST;
  return Direction.EAST; // fallback
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Calculate the snapped angle between two stations
 */
export function calculateSnapAngle(from: Station, to: Station): Direction {
  const dx = to.vertexX - from.vertexX;
  const dy = to.vertexY - from.vertexY;

  // Calculate raw angle in degrees
  const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Snap to nearest 45-degree increment
  const possibleAngles = [0, 45, 90, 135, 180, -180, -135, -90, -45];

  let snappedAngle = possibleAngles[0];
  let minDiff = Math.abs(rawAngle - possibleAngles[0]);

  for (const angle of possibleAngles) {
    const diff = Math.abs(rawAngle - angle);
    if (diff < minDiff) {
      minDiff = diff;
      snappedAngle = angle;
    }
  }

  // Convert to our Direction enum (0-315 range)
  const normalized = normalizeAngle(snappedAngle);
  return normalized as Direction;
}

/**
 * Determine the alignment type between two stations
 */
function getAlignmentType(
  dx: number,
  dy: number,
): "HORIZONTAL" | "VERTICAL" | "DIAGONAL" | "MISALIGNED" {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy === 0) return "HORIZONTAL";
  if (absDx === 0) return "VERTICAL";
  if (absDx === absDy) return "DIAGONAL";
  return "MISALIGNED";
}

/**
 * Calculate the knee point using the "greedy diagonal" approach
 *
 * The greedy diagonal algorithm:
 * 1. Find the shorter of |dx| and |dy|
 * 2. Travel diagonally for that distance (clearing the shorter axis)
 * 3. Then travel straight (H or V) for the remaining distance
 *
 * This naturally creates 45-degree bends in the Harry Beck style
 */
function calculateKneePoint(
  from: Station,
  to: Station,
): { x: number; y: number; diagonalFirst: boolean } {
  const dx = to.vertexX - from.vertexX;
  const dy = to.vertexY - from.vertexY;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine direction signs
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  // Use greedy diagonal: travel diagonally for the shorter distance
  const diagonalDistance = Math.min(absDx, absDy);

  // Decide whether to go diagonal-first or straight-first
  // Diagonal-first is the classic Beck style
  const diagonalFirst = true;

  let kneeX: number;
  let kneeY: number;

  if (diagonalFirst) {
    // Start diagonal, end straight
    kneeX = from.vertexX + signX * diagonalDistance;
    kneeY = from.vertexY + signY * diagonalDistance;
  } else {
    // Start straight, end diagonal
    if (absDx > absDy) {
      // Go horizontal first, then diagonal
      const straightDistance = absDx - absDy;
      kneeX = from.vertexX + signX * straightDistance;
      kneeY = from.vertexY;
    } else {
      // Go vertical first, then diagonal
      const straightDistance = absDy - absDx;
      kneeX = from.vertexX;
      kneeY = from.vertexY + signY * straightDistance;
    }
  }

  return { x: kneeX, y: kneeY, diagonalFirst };
}

/**
 * Calculate path segment between two stations using octilinear routing
 */
export function calculateSegmentPath(
  from: Station,
  to: Station,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousAngle: Direction | null,
): LineSegment {
  const dx = to.vertexX - from.vertexX;
  const dy = to.vertexY - from.vertexY;

  const waypoints: Waypoint[] = [];
  const alignment = getAlignmentType(dx, dy);

  if (alignment !== "MISALIGNED") {
    // Scenario 1: Straight shot (stations are aligned)
    // Horizontal, vertical, or perfect diagonal - no bend needed
    const direction = getDirection(
      dx === 0 ? 0 : dx > 0 ? 1 : -1,
      dy === 0 ? 0 : dy > 0 ? 1 : -1,
    );

    waypoints.push({
      x: from.vertexX,
      y: from.vertexY,
      type: "STATION",
      outgoingAngle: direction,
    });

    waypoints.push({
      x: to.vertexX,
      y: to.vertexY,
      type: "STATION",
      incomingAngle: direction,
    });

    return {
      fromStation: from,
      toStation: to,
      entryAngle: direction,
      exitAngle: direction,
      waypoints,
    };
  }

  // Scenario 2: 45-degree transition (misaligned stations)
  // Use greedy diagonal approach to find the knee point
  const knee = calculateKneePoint(from, to);

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  // Determine the two segment directions
  let firstDirection: Direction;
  let secondDirection: Direction;

  if (knee.diagonalFirst) {
    // First segment is diagonal (from start to knee)
    firstDirection = getDirection(signX, signY);

    // Second segment is straight (from knee to end)
    if (absDx > absDy) {
      // Remaining distance is horizontal
      secondDirection = signX > 0 ? Direction.EAST : Direction.WEST;
    } else {
      // Remaining distance is vertical
      secondDirection = signY > 0 ? Direction.SOUTH : Direction.NORTH;
    }
  } else {
    // First segment is straight
    if (absDx > absDy) {
      firstDirection = signX > 0 ? Direction.EAST : Direction.WEST;
    } else {
      firstDirection = signY > 0 ? Direction.SOUTH : Direction.NORTH;
    }
    // Second segment is diagonal
    secondDirection = getDirection(signX, signY);
  }

  // Build waypoints: Start -> Knee -> End
  waypoints.push({
    x: from.vertexX,
    y: from.vertexY,
    type: "STATION",
    outgoingAngle: firstDirection,
  });

  waypoints.push({
    x: knee.x,
    y: knee.y,
    type: "BEND",
    incomingAngle: firstDirection,
    outgoingAngle: secondDirection,
  });

  waypoints.push({
    x: to.vertexX,
    y: to.vertexY,
    type: "STATION",
    incomingAngle: secondDirection,
  });

  return {
    fromStation: from,
    toStation: to,
    entryAngle: firstDirection,
    exitAngle: secondDirection,
    waypoints,
  };
}
