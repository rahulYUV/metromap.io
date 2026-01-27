/**
 * Station data model for MetroMap.io
 */

import type { Passenger } from "./Passenger";

export interface Station {
  id: string; // Format: "xxYY" where xx and yy are 2-digit vertex coordinates
  vertexX: number; // Vertex grid coordinate (0-48 for width 48)
  vertexY: number; // Vertex grid coordinate (0-32 for height 32)
  passengers: Passenger[]; // Queue of passengers waiting at this station
}

/**
 * Generate a unique station ID from vertex coordinates
 * Format: "xxYY" where xx and yy are zero-padded 2-digit numbers
 * Example: vertex (5, 12) -> "0512"
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
