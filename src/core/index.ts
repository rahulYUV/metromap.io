/**
 * Core Module - Public API
 * Pure game logic with no rendering dependencies.
 */

// Config
export * from "./game/config";

// Models
export * from "./game/models";

// Pathfinding - specific exports to avoid conflicts
export {
  Direction,
  type LineSegment,
  type Waypoint,
  type DirectionVector,
  createSegmentKey,
  getSegmentOrientation,
  normalizeAngle,
  calculateSnapAngle,
  calculateSegmentPath,
} from "./game/pathfinding";

// Simulation
export {
  formatMoney,
  calculateLineLength,
  deductStationCost,
  deductLineCost,
  deductTrainRunningCost,
  addTicketRevenue,
} from "./game/simulation/Economics";
export {
  initializeTrains,
  updateTrains,
  calculateSegmentLength,
  updateTrainPath,
} from "./game/simulation/TrainMovement";
export { updatePassengerSpawning } from "./game/simulation/PassengerSpawner";
export {
  updatePassengerMovement,
  handlePassengerBoarding,
  handlePassengerAlighting,
} from "./game/simulation/PassengerMovement";

// Managers
export {
  StationManager,
  LineManager,
  TrainManager,
  type ValidationResult,
  type BuildingLine,
} from "./game/managers";

// Controller
export {
  GameController,
  type StateChangeListener,
} from "./game/GameController";

// Map Generator
export { MapGenerator } from "./game/MapGenerator";

// Interfaces
export * from "./interfaces/types";
export type {
  IRenderer,
  RenderableMap,
  RenderableStation,
  RenderableLine,
  RenderableTrain,
  MapClickCallback,
  StationClickCallback,
  RendererFactory,
} from "./interfaces/IRenderer";
export type {
  IInputHandler,
  InputEvent,
  InputEventType,
  InputCallback,
} from "./interfaces/IInputHandler";
