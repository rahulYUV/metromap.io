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
 * Calculate the deflection angle at a station when a line enters and exits
 * Returns the smaller angle between the two directions (0-180)
 *
 * For smooth visual flow, we want this angle to be CLOSE TO 180° (straight through)
 * Sharp turns have angles close to 0° or acute angles < 90°
 */
function calculateDeflectionAngle(
  incomingAngle: Direction,
  outgoingAngle: Direction,
): number {
  const diff = Math.abs(incomingAngle - outgoingAngle);
  // The actual deflection is the smaller of the two possible angles
  // e.g., 330° difference = 30° deflection (the line bends 30° not 330°)
  return Math.min(diff, 360 - diff);
}

/**
 * Calculate all possible knee points for a misaligned segment
 * Returns both diagonal-first and straight-first options
 */
function calculateKneePoints(
  from: Station,
  to: Station,
): Array<{ x: number; y: number; diagonalFirst: boolean }> {
  const dx = to.vertexX - from.vertexX;
  const dy = to.vertexY - from.vertexY;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine direction signs
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  const diagonalDistance = Math.min(absDx, absDy);
  const kneeOptions: Array<{ x: number; y: number; diagonalFirst: boolean }> =
    [];

  // Option 1: Diagonal-first (classic Beck style)
  const diagonalFirstKnee = {
    x: from.vertexX + signX * diagonalDistance,
    y: from.vertexY + signY * diagonalDistance,
    diagonalFirst: true,
  };
  kneeOptions.push(diagonalFirstKnee);

  // Option 2: Straight-first (alternative bend)
  let straightFirstKnee: { x: number; y: number; diagonalFirst: boolean };
  if (absDx > absDy) {
    // Go horizontal first, then diagonal
    const straightDistance = absDx - absDy;
    straightFirstKnee = {
      x: from.vertexX + signX * straightDistance,
      y: from.vertexY,
      diagonalFirst: false,
    };
  } else {
    // Go vertical first, then diagonal
    const straightDistance = absDy - absDx;
    straightFirstKnee = {
      x: from.vertexX,
      y: from.vertexY + signY * straightDistance,
      diagonalFirst: false,
    };
  }
  kneeOptions.push(straightFirstKnee);

  return kneeOptions;
}

/**
 * Calculate the knee point that optimizes the angle at the middle station
 * when connecting three stations A->B->C
 */
function calculateOptimalKneePoint(
  from: Station,
  to: Station,
  nextAngle: Direction | null,
): { x: number; y: number; diagonalFirst: boolean } {
  const kneeOptions = calculateKneePoints(from, to);

  // If no next segment, use default (diagonal-first)
  if (nextAngle === null) {
    return kneeOptions[0];
  }

  const dx = to.vertexX - from.vertexX;
  const dy = to.vertexY - from.vertexY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  // Evaluate each knee option by the deflection angle it creates at station 'to'
  let bestKnee = kneeOptions[0];
  let smallestDeflection = Infinity;

  for (const knee of kneeOptions) {
    // Calculate the exit angle from this knee option
    let exitAngle: Direction;

    if (knee.diagonalFirst) {
      // Second segment is straight
      if (absDx > absDy) {
        exitAngle = signX > 0 ? Direction.EAST : Direction.WEST;
      } else {
        exitAngle = signY > 0 ? Direction.SOUTH : Direction.NORTH;
      }
    } else {
      // Second segment is diagonal
      exitAngle = getDirection(signX, signY);
    }

    // Calculate the deflection angle at station 'to'
    // The line arrives at 'to' with exitAngle and leaves with nextAngle
    const deflection = calculateDeflectionAngle(exitAngle, nextAngle);

    // We want MINIMUM deflection (closest to 180° = straight through)
    // deflection of 0° = line goes straight through (180° visual angle)
    // deflection of 45° = gentle curve (135° visual angle)
    // deflection of 90° = right angle turn (90° visual angle)
    // deflection of 135° = sharp turn (45° visual angle)
    // deflection of 180° = U-turn (0° visual angle - very sharp!)
    //
    // So we minimize deflection to maximize smoothness
    if (deflection < smallestDeflection) {
      smallestDeflection = deflection;
      bestKnee = knee;
    }
  }

  return bestKnee;
}

/**
 * Calculate path segment between two stations using octilinear routing
 * @param from - Starting station
 * @param to - Ending station
 * @param nextAngle - The direction of the next segment (for optimizing bends at 'to')
 */
export function calculateSegmentPath(
  from: Station,
  to: Station,
  nextAngle: Direction | null,
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
  // Find optimal knee point that creates best angle with next segment
  const knee = calculateOptimalKneePoint(from, to, nextAngle);

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
