/**
 * Station data model for MetroMap.io
 */

import type { Passenger } from "./Passenger";

export interface Station {
  id: string;
  vertexX: number;
  vertexY: number;
  passengers: Passenger[];
  label: string;
}

/**
 * Generate a station label from an index
 * A, B, C... Z, AA, AB, AC... AZ, BA, BB...
 */
export function generateStationLabel(index: number): string {
  let label = "";
  let num = index;

  do {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);

  return label;
}

/**
 * Generate a unique station ID from vertex coordinates
 * Format: "xxYY" where xx and yy are zero-padded 2-digit numbers
 */
export function generateStationId(vertexX: number, vertexY: number): string {
  const x = vertexX.toString().padStart(2, "0");
  const y = vertexY.toString().padStart(2, "0");
  return `${x}${y}`;
}

/**
 * Parse station ID to get vertex coordinates
 */
export function parseStationId(id: string): {
  vertexX: number;
  vertexY: number;
} {
  const x = parseInt(id.substring(0, 2), 10);
  const y = parseInt(id.substring(2, 4), 10);
  return { vertexX: x, vertexY: y };
}

/**
 * Create a new station
 */
export function createStation(
  vertexX: number,
  vertexY: number,
  label: string = "",
): Station {
  return {
    id: generateStationId(vertexX, vertexY),
    vertexX,
    vertexY,
    passengers: [],
    label,
  };
}
