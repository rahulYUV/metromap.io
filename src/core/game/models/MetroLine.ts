/**
 * Metro Line data model for MetroMap.io
 */

import type { Train } from "./Train";

export type LineColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "cyan"
  | "magenta"
  | "pink"
  | "teal"
  | "lime"
  | "orange"
  | "brown"
  | "grey";

export const LINE_COLORS: LineColor[] = [
  "red",
  "green",
  "yellow",
  "blue",
  "cyan",
  "magenta",
  "pink",
  "teal",
  "lime",
  "orange",
  "brown",
  "grey",
];

export const LINE_COLOR_HEX: Record<LineColor, number> = {
  red: 0xe74c3c,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  blue: 0x3498db,
  cyan: 0x1abc9c,
  magenta: 0x9b59b6,
  pink: 0xff69b4,
  teal: 0x16a085,
  lime: 0x7bed9f,
  orange: 0xe67e22,
  brown: 0x8b4513,
  grey: 0x95a5a6,
};

export interface MetroLine {
  id: string;
  color: LineColor;
  stationIds: string[];
  isLoop: boolean;
  trains: Train[];
}

/**
 * Generate a unique line ID
 */
export function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a line forms a loop (first and last station are the same)
 */
export function isLineLoop(stationIds: string[]): boolean {
  return (
    stationIds.length > 2 && stationIds[0] === stationIds[stationIds.length - 1]
  );
}

/**
 * Validate that a station isn't already in the line (except for closing a loop)
 */
export function canAddStationToLine(
  stationIds: string[],
  newStationId: string,
): boolean {
  if (stationIds.length === 0) {
    return true;
  }

  // Check if trying to close a loop
  if (newStationId === stationIds[0] && stationIds.length >= 2) {
    return true;
  }

  // Check if station is already in the line
  return !stationIds.includes(newStationId);
}

/**
 * Create a new metro line
 */
export function createLine(
  color: LineColor,
  stationIds: string[],
  isLoop: boolean = false,
): MetroLine {
  return {
    id: generateLineId(),
    color,
    stationIds,
    isLoop,
    trains: [],
  };
}
