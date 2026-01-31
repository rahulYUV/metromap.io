/**
 * Central Configuration for MetroMap.io
 * Defines all gameplay balance constants and core settings.
 */

// --- Map Configuration ---
export const MAP_WIDTH = 48; // Grid width
export const MAP_HEIGHT = 32; // Grid height
export const TILE_SIZE = 16; // Visual size in pixels of one grid square

// --- Train Configuration ---
export const TRAIN_MAX_CAPACITY = 30; // Maximum number of passengers per train
export const TRAIN_DEFAULT_SPEED = 5; // Base train speed in grid squares per second
export const TRAIN_STOP_DURATION_SQUARES = 2; // Time to stop is equivalent to covering this many squares
export const TRAIN_ACCEL_DECEL_DISTANCE = 1; // Distance in squares to accelerate/decelerate

// --- Spawning Configuration ---
export const BASE_SPAWN_RATE = 0.2; // Base passengers per game-hour (before density modifiers)

// --- Simulation Time Configuration ---
// Game runs at this many milliseconds per real second for 1x speed
// 1 week (game time) in 60 real seconds
// 1 week = 7 days * 24 hours * 3600 seconds * 1000 ms = 604,800,000 ms
// 604,800,000 ms / 60 sec = 10,080,000 ms/sec
export const BASE_GAME_SPEED = (7 * 24 * 60 * 60 * 1000) / 60;

// Initial game start time (2025-01-01 08:00:00)
export const GAME_START_TIME_ISO = "2025-01-01T08:00:00";

// --- Economic Configuration ---
export const STARTING_MONEY = 10000; // Starting cash in dollars
export const STATION_BUILD_COST = 500; // Cost to build one station
export const LINE_BUILD_COST_PER_SQUARE = 50; // Cost per grid square to build a line
export const TRAIN_RUNNING_COST_PER_SQUARE = 2; // Cost per grid square for train travel
export const TICKET_REVENUE = 2; // Revenue per completed passenger journey
