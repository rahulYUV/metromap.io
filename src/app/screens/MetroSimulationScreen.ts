/**
 * Metro Simulation Screen for MetroMap.io
 * Runs the metro simulation with time progression and passenger movement
 */

import { Container, Graphics, Ticker } from "pixi.js";
import { animate } from "motion";

import { MapRenderer } from "../game/MapRenderer";
import { MetroRenderer, TILE_SIZE } from "../game/MetroRenderer";
import type { GameState } from "../game/models/GameState";
import { saveGameState } from "../game/models/GameState";
import type { Station } from "../game/models/Station";
import { FlatButton } from "../ui/FlatButton";
import { Label } from "../ui/Label";
import type { MetroLine } from "../game/models/MetroLine";
import { Train, createTrain } from "../game/models/Train";
import { updatePassengerSpawning } from "../game/simulation/PassengerSpawner";
import { updatePassengerMovement } from "../game/simulation/PassengerMovement";
import {
  calculateSegmentPath,
  calculateSnapAngle,
  Direction,
  type LineSegment,
} from "../game/pathfinding/LinePath";

// Time progression speeds (milliseconds per real second)
const SPEED_1X = 5 * 60 * 1000; // 5 minutes per second (12 seconds = 1 hour)
const SPEED_2X = 10 * 60 * 1000; // 10 minutes per second (6 seconds = 1 hour)
const SPEED_4X = 20 * 60 * 1000; // 20 minutes per second (3 seconds = 1 hour)
const SPEED_12X = 60 * 60 * 1000; // 60 minutes per second (1 second = 1 hour)

type SimulationSpeed = "1x" | "2x" | "4x" | "12x";

export class MetroSimulationScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  private titleLabel: Label;
  private clockLabel: Label;

  private stopButton: FlatButton;
  private speed1xButton: FlatButton;
  private speed2xButton: FlatButton;
  private speed4xButton: FlatButton;
  private speed12xButton: FlatButton;

  private mapRenderer: MapRenderer;
  private metroRenderer: MetroRenderer;
  private mapContainer: Container;
  private mapBackground: Graphics;

  private gameState!: GameState;
  private isRunning: boolean = false;
  private currentSpeed: SimulationSpeed = "1x";
  private lastUpdateTime: number = 0;

  constructor() {
    super();

    // Title
    this.titleLabel = new Label({
      text: "Metro Simulation",
      style: {
        fontSize: 36,
        fill: 0xffffff,
      },
    });
    this.addChild(this.titleLabel);

    // Clock display
    this.clockLabel = new Label({
      text: this.formatDateTime(new Date("2025-01-01T08:00:00")),
      style: {
        fontSize: 24,
        fill: 0x88ccff,
        fontFamily: "monospace",
      },
    });
    this.addChild(this.clockLabel);

    // Stop simulation button
    this.stopButton = new FlatButton({
      text: "Stop Simulation",
      width: 160,
      height: 50,
      fontSize: 18,
      backgroundColor: 0xe74c3c,
    });
    this.stopButton.onPress.connect(() => this.stopSimulation());
    this.addChild(this.stopButton);

    // Speed control buttons
    this.speed1xButton = new FlatButton({
      text: "1x",
      width: 60,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x4a90e2,
    });
    this.speed1xButton.onPress.connect(() => this.setSpeed("1x"));
    this.addChild(this.speed1xButton);

    this.speed2xButton = new FlatButton({
      text: "2x",
      width: 60,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x555555,
    });
    this.speed2xButton.onPress.connect(() => this.setSpeed("2x"));
    this.addChild(this.speed2xButton);

    this.speed4xButton = new FlatButton({
      text: "4x",
      width: 60,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x555555,
    });
    this.speed4xButton.onPress.connect(() => this.setSpeed("4x"));
    this.addChild(this.speed4xButton);

    this.speed12xButton = new FlatButton({
      text: "12x",
      width: 60,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x555555,
    });
    this.speed12xButton.onPress.connect(() => this.setSpeed("12x"));
    this.addChild(this.speed12xButton);

    // Map display container
    this.mapContainer = new Container();
    this.addChild(this.mapContainer);

    // Map background
    this.mapBackground = new Graphics();
    this.mapContainer.addChild(this.mapBackground);

    // Map renderer
    this.mapRenderer = new MapRenderer();
    this.mapContainer.addChild(this.mapRenderer);

    // Metro Renderer (Lines, Trains, Stations)
    this.metroRenderer = new MetroRenderer();
    this.mapContainer.addChild(this.metroRenderer);
  }

  /**
   * Format date and time for display
   */
  private formatDateTime(date: Date): string {
    // Check if date is valid
    if (!date || isNaN(date.getTime())) {
      const defaultDate = new Date("2025-01-01T08:00:00");
      return this.formatDateTime(defaultDate);
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Set simulation speed
   */
  private setSpeed(speed: SimulationSpeed): void {
    this.currentSpeed = speed;

    // Update button visual states
    // Use tint to change color (0xffffff = original, darker = inactive)
    if (speed === "1x") {
      this.speed1xButton.alpha = 1.0;
      (this.speed1xButton.defaultView as Graphics).tint = 0x4a90e2; // Blue
      this.speed2xButton.alpha = 0.7;
      (this.speed2xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed4xButton.alpha = 0.7;
      (this.speed4xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed12xButton.alpha = 0.7;
      (this.speed12xButton.defaultView as Graphics).tint = 0x888888; // Gray
    } else if (speed === "2x") {
      this.speed1xButton.alpha = 0.7;
      (this.speed1xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed2xButton.alpha = 1.0;
      (this.speed2xButton.defaultView as Graphics).tint = 0x4a90e2; // Blue
      this.speed4xButton.alpha = 0.7;
      (this.speed4xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed12xButton.alpha = 0.7;
      (this.speed12xButton.defaultView as Graphics).tint = 0x888888; // Gray
    } else if (speed === "4x") {
      this.speed1xButton.alpha = 0.7;
      (this.speed1xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed2xButton.alpha = 0.7;
      (this.speed2xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed4xButton.alpha = 1.0;
      (this.speed4xButton.defaultView as Graphics).tint = 0x4a90e2; // Blue
      this.speed12xButton.alpha = 0.7;
      (this.speed12xButton.defaultView as Graphics).tint = 0x888888; // Gray
    } else if (speed === "12x") {
      this.speed1xButton.alpha = 0.7;
      (this.speed1xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed2xButton.alpha = 0.7;
      (this.speed2xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed4xButton.alpha = 0.7;
      (this.speed4xButton.defaultView as Graphics).tint = 0x888888; // Gray
      this.speed12xButton.alpha = 1.0;
      (this.speed12xButton.defaultView as Graphics).tint = 0x4a90e2; // Blue
    }
  }

  /**
   * Stop simulation and return to building screen
   */
  private async stopSimulation(): Promise<void> {
    this.isRunning = false;

    // Save current state
    saveGameState(this.gameState);

    // Import and navigate to building screen
    const { MetroBuildingScreen } = await import("./MetroBuildingScreen");
    const { engine } = await import("../getEngine");

    await engine().navigation.showScreen(MetroBuildingScreen);
    const screen = engine().navigation.currentScreen as InstanceType<
      typeof MetroBuildingScreen
    >;
    if (screen && screen.setGameState) {
      screen.setGameState(this.gameState);
    }
  }

  /**
   * Update simulation - called every frame
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateSimulation = (_ticker: Ticker): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaSeconds = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    // Calculate time progression based on speed
    let speedMultiplier: number; // For game clock
    let movementMultiplier: number; // For train movement

    switch (this.currentSpeed) {
      case "1x":
        speedMultiplier = SPEED_1X;
        movementMultiplier = 1;
        break;
      case "2x":
        speedMultiplier = SPEED_2X;
        movementMultiplier = 2;
        break;
      case "4x":
        speedMultiplier = SPEED_4X;
        movementMultiplier = 4;
        break;
      case "12x":
        speedMultiplier = SPEED_12X;
        movementMultiplier = 12;
        break;
    }

    // Update simulation time
    const timeIncrement = deltaSeconds * speedMultiplier;
    this.gameState.simulationTime += timeIncrement;

    // Update clock display
    const currentDate = new Date(this.gameState.simulationTime);
    this.clockLabel.text = this.formatDateTime(currentDate);

    // Update passenger spawning
    // We pass real delta seconds scaled by speedMultiplier to reflect game time progression?
    // The spawner uses BASE_SPAWN_RATE (passengers per game-minute).
    // So we should pass the *game time delta* in minutes?
    // Or just pass seconds and let spawner handle it?
    // The current implementation of spawner takes 'deltaSeconds' and multiplies by rate.
    // If rate is "per second", then passing real delta * multiplier simulates acceleration.
    updatePassengerSpawning(this.gameState, deltaSeconds * speedMultiplier);

    // Update trains
    this.updateTrains(deltaSeconds * movementMultiplier);
    this.updateMetroRenderer(true); // Only update trains
  };

  /**
   * Start the simulation
   */
  public startSimulation(): void {
    this.isRunning = true;
    this.lastUpdateTime = performance.now();

    // Initialize trains if needed
    this.initializeTrains();

    // Initialize button states
    this.setSpeed(this.currentSpeed);
  }

  /**
   * Initialize trains on lines that don't have them
   */
  private initializeTrains(): void {
    for (const line of this.gameState.lines) {
      if (!line.trains || line.trains.length === 0) {
        line.trains = [];
        // Add one train per line
        const train = createTrain(line.id, 0, 1); // Start at first station, 1 square/sec

        // Initial path calculation
        this.updateTrainPath(train, line);

        line.trains.push(train);
      } else {
        // Ensure existing trains have paths (e.g. after reload)
        for (const train of line.trains) {
          // Ensure passengers array exists (for backward compatibility)
          if (!train.passengers) {
            train.passengers = [];
          }
          if (!train.currentSegment) {
            this.updateTrainPath(train, line);
          }
        }
      }
    }
  }

  /**
   * Update trains movement
   */
  private updateTrains(deltaSeconds: number): void {
    for (const line of this.gameState.lines) {
      if (!line.trains) continue;

      for (const train of line.trains) {
        if (!train.currentSegment) {
          this.updateTrainPath(train, line);
          if (!train.currentSegment) continue; // Should not happen unless line invalid
        }

        // Calculate movement distance
        const moveDist = train.speed * deltaSeconds;
        const progressIncrement = moveDist / train.totalLength;

        train.progress += progressIncrement;

        // Check if reached destination
        if (train.progress >= 1.0) {
          // Arrived at station
          train.currentStationIdx = train.targetStationIdx;
          train.progress = 0; // Reset progress (lose overflow for simplicity or can carry over)

          // Determine next target and direction BEFORE passenger boarding
          // This ensures passengers see the correct direction when deciding to board
          if (line.isLoop) {
            // Circular movement
            if (train.direction === 1) {
              train.targetStationIdx =
                (train.currentStationIdx + 1) % line.stationIds.length;
            } else {
              train.targetStationIdx =
                (train.currentStationIdx - 1 + line.stationIds.length) %
                line.stationIds.length;
            }
          } else {
            // Linear movement
            if (train.direction === 1) {
              if (train.currentStationIdx >= line.stationIds.length - 1) {
                // Reached end, reverse
                train.direction = -1;
                train.targetStationIdx = train.currentStationIdx - 1;
              } else {
                train.targetStationIdx = train.currentStationIdx + 1;
              }
            } else {
              if (train.currentStationIdx <= 0) {
                // Reached start, reverse
                train.direction = 1;
                train.targetStationIdx = train.currentStationIdx + 1;
              } else {
                train.targetStationIdx = train.currentStationIdx - 1;
              }
            }
          }

          // Handle passenger boarding and alighting AFTER direction is set
          const currentStationId = line.stationIds[train.currentStationIdx];
          const currentStation = this.gameState.stations.find(
            (s) => s.id === currentStationId,
          );
          if (currentStation) {
            updatePassengerMovement(train, currentStation, this.gameState);
          }

          // Calculate new path
          this.updateTrainPath(train, line);
        }
      }
    }
  }

  /**
   * Calculate and cache path for a train's next segment
   */
  private updateTrainPath(train: Train, line: MetroLine): void {
    const idxA = train.currentStationIdx;
    const idxB = train.targetStationIdx;

    const fromId = line.stationIds[idxA];
    const toId = line.stationIds[idxB];

    const stationA = this.gameState.stations.find((s) => s.id === fromId);
    const stationB = this.gameState.stations.find((s) => s.id === toId);

    if (!stationA || !stationB) return;

    // Handle zero-distance segments (e.g. wrap-around on loops where start==end)
    if (stationA.id === stationB.id) {
      train.currentSegment = {
        fromStation: stationA,
        toStation: stationB,
        entryAngle: Direction.EAST,
        exitAngle: Direction.EAST,
        waypoints: [
          { x: stationA.vertexX, y: stationA.vertexY, type: "STATION" },
        ],
      };
      train.totalLength = 0;
      return;
    }

    // To ensure the train follows the exact path drawn on screen,
    // we must calculate the path in the "canonical" direction (increasing index)
    // as that's how the line was built and rendered.
    // If the train is moving backwards, we calculate the forward path and reverse it.

    const minIdx = Math.min(idxA, idxB);
    const maxIdx = Math.max(idxA, idxB);

    const canonicalFromId = line.stationIds[minIdx];
    const canonicalToId = line.stationIds[maxIdx];

    const canonicalFrom = this.gameState.stations.find(
      (s) => s.id === canonicalFromId,
    )!;
    const canonicalTo = this.gameState.stations.find(
      (s) => s.id === canonicalToId,
    )!;

    // Determine "next" angle for optimization, matching MetroBuildingScreen logic
    // We look at the station *after* the segment end to smooth the corner
    let nextAngle: Direction | null = null;
    if (maxIdx + 1 < line.stationIds.length) {
      const nextNextId = line.stationIds[maxIdx + 1];
      const nextNextStation = this.gameState.stations.find(
        (s) => s.id === nextNextId,
      );
      if (nextNextStation) {
        nextAngle = calculateSnapAngle(canonicalTo, nextNextStation);
      }
    }

    // Calculate the canonical path
    const segment = calculateSegmentPath(canonicalFrom, canonicalTo, nextAngle);

    // If train is moving backwards relative to line definition, reverse waypoints
    if (idxA > idxB) {
      segment.waypoints.reverse();
    }

    train.currentSegment = segment;
    train.totalLength = this.calculateSegmentLength(segment);
  }

  /**
   * Calculate total length of a segment in grid units
   */
  private calculateSegmentLength(segment: LineSegment): number {
    let length = 0;
    const waypoints = segment.waypoints;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * Update metro renderer visual state
   * @param trainsOnly If true, only redraw trains (optimization)
   */
  private updateMetroRenderer(trainsOnly: boolean = false): void {
    if (!trainsOnly) {
      this.metroRenderer.renderStations(this.gameState.stations);
      this.metroRenderer.renderLines(
        this.gameState.lines,
        this.gameState.stations,
      );
    } else {
      // Always update passenger counts during simulation
      this.metroRenderer.renderStationLabels(this.gameState.stations);
    }

    this.metroRenderer.renderTrains(
      this.gameState.lines,
      this.gameState.stations,
    );
  }

  /**
   * Set game state
   */
  public setGameState(gameState: GameState): void {
    this.gameState = gameState;

    // Ensure simulationTime is valid
    if (
      !this.gameState.simulationTime ||
      isNaN(this.gameState.simulationTime)
    ) {
      this.gameState.simulationTime = new Date("2025-01-01T08:00:00").getTime();
    }

    this.mapRenderer.renderMap(gameState.map);
    this.drawMapBackground();
    this.updateMetroRenderer(false); // Draw everything

    // Set up station click handler
    this.metroRenderer.onStationClick = (station) => {
      this.showStationDetails(station);
    };

    // Update clock display
    const currentDate = new Date(this.gameState.simulationTime);
    this.clockLabel.text = this.formatDateTime(currentDate);
  }

  /**
   * Draw map background
   */
  private drawMapBackground(): void {
    const mapWidth = this.gameState.map.width * TILE_SIZE;
    const mapHeight = this.gameState.map.height * TILE_SIZE;

    this.mapBackground.clear();
    this.mapBackground.rect(0, 0, mapWidth, mapHeight);
    this.mapBackground.stroke({ width: 2, color: 0x444444 });
  }

  /**
   * Show station details popup
   */
  private async showStationDetails(station: Station): Promise<void> {
    const { StationDetailPopup, setStationForPopup } =
      await import("../popups/StationDetailPopup");
    const { engine } = await import("../getEngine");

    setStationForPopup(station, this.gameState.stations);
    engine().navigation.presentPopup(StationDetailPopup);
  }

  /**
   * Layout UI elements
   */
  public resize(width: number, height: number): void {
    const centerX = width * 0.5;

    // Title at top left
    this.titleLabel.x = 150;
    this.titleLabel.y = 30;

    // Clock at top right
    this.clockLabel.x = width - 250;
    this.clockLabel.y = 35;

    // Control buttons at bottom
    const bottomY = height - 80;

    this.stopButton.x = centerX - 280;
    this.stopButton.y = bottomY;

    this.speed1xButton.x = centerX + 100;
    this.speed1xButton.y = bottomY;

    this.speed2xButton.x = centerX + 170;
    this.speed2xButton.y = bottomY;

    this.speed4xButton.x = centerX + 240;
    this.speed4xButton.y = bottomY;

    this.speed12xButton.x = centerX + 310;
    this.speed12xButton.y = bottomY;

    // Map display - centered
    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();

    const mapStartY = 90;
    const availableHeight = height - mapStartY - 120;
    const availableWidth = width - 40;
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    const mapScale = Math.min(1, scaleX, scaleY);

    this.mapContainer.scale.set(mapScale);
    this.mapContainer.x = centerX - (mapWidth * mapScale) / 2;
    this.mapContainer.y = mapStartY;
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    const elementsToAnimate = [
      this.titleLabel,
      this.clockLabel,
      this.stopButton,
      this.speed1xButton,
      this.speed2xButton,
      this.speed4xButton,
      this.speed12xButton,
      this.mapContainer,
    ];

    for (const element of elementsToAnimate) {
      element.alpha = 0;
    }

    await animate(elementsToAnimate, { alpha: [0, 1] }, { duration: 0.3 })
      .finished;
  }

  /** Called by navigation system every frame */
  public update(): void {
    // Delegate to our update simulation method
    this.updateSimulation(Ticker.shared);
  }

  /** Called when screen is removed */
  public onDestroy(): void {
    this.isRunning = false;
  }
}
