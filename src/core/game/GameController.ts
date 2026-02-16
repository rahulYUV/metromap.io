/**
 * Game Controller for MetroMap.io
 * Central coordinator for all game logic.
 * Pure TypeScript with no renderer dependencies.
 */

import type { GameAction, ActionResult, LineColor } from "../interfaces/types";
import {
  createGameState,
  saveGameState,
  loadGameState,
  clearSavedGame,
  hasSavedGame,
  type GameState,
} from "./models/GameState";
import type { MapGrid } from "./models/MapGrid";
import type { MetroLine } from "./models/MetroLine";
import { StationManager } from "./managers/StationManager";
import { LineManager } from "./managers/LineManager";
import { TrainManager } from "./managers/TrainManager";
import { initializeTrains, updateTrains } from "./simulation/TrainMovement";
import { updatePassengerSpawning } from "./simulation/PassengerSpawner";

/**
 * State change listener type
 */
export type StateChangeListener = (state: Readonly<GameState>) => void;

/**
 * Game Controller - central coordinator for all game logic
 */
export class GameController {
  private state: GameState;
  private listeners: Set<StateChangeListener> = new Set();

  // Managers
  private stationManager: StationManager;
  private lineManager: LineManager;
  private trainManager: TrainManager;

  constructor(seed: number, map: MapGrid) {
    this.state = createGameState(seed, map);
    this.stationManager = new StationManager(this.state);
    this.lineManager = new LineManager(this.state);
    this.trainManager = new TrainManager(this.state);
  }

  // ========================================================================
  // Static Factory Methods
  // ========================================================================

  /**
   * Create a new game
   */
  static createNew(seed: number, map: MapGrid): GameController {
    return new GameController(seed, map);
  }

  /**
   * Load a saved game
   */
  static loadSaved(): GameController | null {
    const savedState = loadGameState();
    if (!savedState) return null;

    const controller = new GameController(savedState.seed, savedState.map);
    controller.state = savedState;
    // Re-initialize managers with loaded state
    controller.stationManager = new StationManager(controller.state);
    controller.lineManager = new LineManager(controller.state);
    controller.trainManager = new TrainManager(controller.state);
    return controller;
  }

  // ========================================================================
  // Main Update Loop
  // ========================================================================

  /**
   * Main update loop - called by renderer
   * @param deltaMs - Delta time in milliseconds
   */
  update(deltaMs: number): void {
    if (this.state.isPaused) return;

    // Convert ms to seconds for simulation
    const deltaSeconds = (deltaMs * this.state.speed) / 1000;

    // Update simulation time
    const gameTimeDelta = deltaSeconds * 1000;
    this.state.simulationTime += gameTimeDelta;

    // Run simulation systems
    updatePassengerSpawning(this.state, deltaSeconds);
    updateTrains(this.state, deltaSeconds);

    // Notify listeners
    this.notifyListeners();
  }

  // ========================================================================
  // Action Dispatch
  // ========================================================================

  /**
   * Dispatch a game action
   */
  dispatch(action: GameAction): ActionResult {
    switch (action.type) {
      case "PLACE_STATION":
        return this.dispatchPlaceStation(action.payload);
      case "REMOVE_STATION":
        return this.dispatchRemoveStation(action.payload);
      case "START_LINE":
        return this.dispatchStartLine(action.payload);
      case "ADD_STATION_TO_LINE":
        return this.dispatchAddStationToLine(action.payload);
      case "COMPLETE_LINE":
        return this.dispatchCompleteLine();
      case "CANCEL_LINE":
        return this.dispatchCancelLine();
      case "ADD_TRAIN":
        return this.dispatchAddTrain(action.payload);
      case "REMOVE_TRAIN":
        return this.dispatchRemoveTrain(action.payload);
      case "PAUSE":
        return this.dispatchPause();
      case "RESUME":
        return this.dispatchResume();
      case "SET_SPEED":
        return this.dispatchSetSpeed(action.payload);
      default:
        return { success: false, error: `Unknown action` };
    }
  }

  private dispatchPlaceStation(payload: unknown): ActionResult {
    const { vertexX, vertexY } = payload as {
      vertexX: number;
      vertexY: number;
    };
    const result = this.stationManager.placeStation(vertexX, vertexY);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchRemoveStation(payload: unknown): ActionResult {
    const { stationId } = payload as { stationId: string };
    const result = this.stationManager.removeStation(stationId);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchStartLine(payload: unknown): ActionResult {
    const { color } = payload as { color: LineColor };
    const result = this.lineManager.startLine(color);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchAddStationToLine(payload: unknown): ActionResult {
    const { stationId } = payload as { stationId: string };
    const result = this.lineManager.addStationToLine(stationId);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchCompleteLine(): ActionResult {
    const result = this.lineManager.completeLine();
    if (result.success) {
      // Add initial train to the line
      const line = result.data as MetroLine;
      this.trainManager.addTrainToLine(line.id);
      this.notifyListeners();
    }
    return result;
  }

  private dispatchCancelLine(): ActionResult {
    this.lineManager.cancelLine();
    this.notifyListeners();
    return { success: true };
  }

  private dispatchAddTrain(payload: unknown): ActionResult {
    const { lineId } = payload as { lineId: string };
    const result = this.trainManager.addTrainToLine(lineId);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchRemoveTrain(payload: unknown): ActionResult {
    const { lineId, trainId } = payload as {
      lineId: string;
      trainId?: string;
    };
    const result = this.trainManager.removeTrainFromLine(lineId, trainId);
    if (result.success) {
      this.notifyListeners();
    }
    return result;
  }

  private dispatchPause(): ActionResult {
    this.state.isPaused = true;
    this.notifyListeners();
    return { success: true };
  }

  private dispatchResume(): ActionResult {
    this.state.isPaused = false;
    this.notifyListeners();
    return { success: true };
  }

  private dispatchSetSpeed(payload: unknown): ActionResult {
    const { speed } = payload as { speed: number };
    if (speed !== 1 && speed !== 2 && speed !== 4) {
      return { success: false, error: "Invalid speed value" };
    }
    this.state.speed = speed;
    this.notifyListeners();
    return { success: true };
  }

  // ========================================================================
  // State Access
  // ========================================================================

  /**
   * Get the current game state (read-only)
   */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * Get station manager for direct access
   */
  getStationManager(): StationManager {
    return this.stationManager;
  }

  /**
   * Get line manager for direct access
   */
  getLineManager(): LineManager {
    return this.lineManager;
  }

  /**
   * Get train manager for direct access
   */
  getTrainManager(): TrainManager {
    return this.trainManager;
  }

  // ========================================================================
  // Observer Pattern
  // ========================================================================

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  /**
   * Save the current game state
   */
  save(): void {
    saveGameState(this.state);
  }

  /**
   * Clear saved game
   */
  clearSaved(): void {
    clearSavedGame();
  }

  /**
   * Check if a saved game exists
   */
  static hasSavedGame(): boolean {
    return hasSavedGame();
  }

  // ========================================================================
  // Simulation Control
  // ========================================================================

  /**
   * Initialize trains for simulation
   * Called when transitioning to simulation screen
   */
  initializeSimulation(): void {
    initializeTrains(this.state);
  }

  /**
   * Check if simulation is paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get current simulation speed
   */
  getSpeed(): number {
    return this.state.speed;
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    this.state.isPaused = !this.state.isPaused;
    this.notifyListeners();
  }
}
