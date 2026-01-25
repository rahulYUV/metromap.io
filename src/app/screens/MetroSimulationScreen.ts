/**
 * Metro Simulation Screen for MetroMap.io
 * Runs the metro simulation with time progression and passenger movement
 */

import { Container, Graphics, Ticker } from "pixi.js";
import { animate } from "motion";

import { MapRenderer } from "../game/MapRenderer";
import type { GameState } from "../game/models/GameState";
import { saveGameState } from "../game/models/GameState";
import { FlatButton } from "../ui/FlatButton";
import { Label } from "../ui/Label";
import type { MetroLine } from "../game/models/MetroLine";
import { LINE_COLOR_HEX } from "../game/models/MetroLine";
import { Station } from "../game/models/Station";
import { Train, createTrain } from "../game/models/Train";
import {
  calculateSegmentPath,
  calculateSnapAngle,
  createSegmentKey,
  getSegmentOrientation,
  DIRECTION_VECTORS,
  Direction,
  LineSegment,
  Waypoint,
} from "../game/pathfinding/LinePath";

const TILE_SIZE = 16;
const STATION_RADIUS = TILE_SIZE * 0.5;
const STATION_COLOR = 0xffffff;
const STATION_BORDER_COLOR = 0x000000;
const STATION_BORDER_WIDTH = 2;
const LINE_WIDTH = 4;
const LINE_OFFSET = 4; // Offset for parallel lines
const TRAIN_HEIGHT = 8; // Width of train

// Time progression speeds (milliseconds per real second)
const SPEED_1X = 5 * 60 * 1000; // 5 minutes per second (12 seconds = 1 hour)
const SPEED_2X = 10 * 60 * 1000; // 10 minutes per second (6 seconds = 1 hour)
const SPEED_4X = 20 * 60 * 1000; // 20 minutes per second (3 seconds = 1 hour)
const SPEED_12X = 60 * 60 * 1000; // 60 minutes per second (1 second = 1 hour)

type SimulationSpeed = "1x" | "2x" | "4x" | "12x";

/**
 * Information about lines sharing a segment
 */
interface SegmentSharingInfo {
  lineIndices: number[]; // Indices of lines that share this segment
  orientation: "HORIZONTAL" | "VERTICAL" | "DIAGONAL";
}

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
  private mapContainer: Container;
  private mapBackground: Graphics;
  private linesLayer: Graphics;
  private trainsLayer: Graphics;
  private stationsLayer: Graphics;

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

    // Layers
    this.linesLayer = new Graphics();
    this.mapContainer.addChild(this.linesLayer);

    this.trainsLayer = new Graphics();
    this.mapContainer.addChild(this.trainsLayer);

    this.stationsLayer = new Graphics();
    this.mapContainer.addChild(this.stationsLayer);
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

    // Update trains
    this.updateTrains(deltaSeconds * movementMultiplier);
    this.drawTrains();
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

          // Determine next target
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
   * Draw trains
   */
  private drawTrains(): void {
    this.trainsLayer.clear();
    const segmentMap = this.buildSegmentSharingMap();

    for (const line of this.gameState.lines) {
      if (!line.trains) continue;

      const lineColor = LINE_COLOR_HEX[line.color];
      const lineIndex = this.gameState.lines.indexOf(line);

      for (const train of line.trains) {
        if (!train.currentSegment) continue;

        // Calculate position based on progress
        const pos = this.getTrainPosition(train, lineIndex, segmentMap);
        if (!pos) continue;

        // Draw train shape: [__]>
        // Rectangle body + Triangle front
        // Oriented by pos.angle

        // Train dimensions
        const h = TRAIN_HEIGHT;

        // Transform context
        // We manually rotate points because Graphics rotation affects entire graphic context or we'd need many containers
        // Using a temporary Matrix or manual calculation is better for a single Graphics layer

        const cos = Math.cos(pos.angle);
        const sin = Math.sin(pos.angle);

        // Shape definition (local coords, 0,0 is center)
        // Body: Rect part length = 13.5 (1.5x original 9)
        // Head: Triangle part length = 3
        // Total Length: 16.5
        // Centered around 0, so extends from -8.25 to 8.25

        const tailX = -8.25;
        const shoulderX = 5.25;
        const tipX = 8.25;
        const halfH = h / 2;

        // Vertices for the single unified shape (pentagon)
        // Order: Tail Top -> Shoulder Top -> Tip -> Shoulder Bottom -> Tail Bottom
        const trainPoints = [
          { x: tailX, y: -halfH },
          { x: shoulderX, y: -halfH },
          { x: tipX, y: 0 },
          { x: shoulderX, y: halfH },
          { x: tailX, y: halfH },
        ];

        // Transform and draw
        const tPoints = trainPoints.map((p) => ({
          x: pos.x + (p.x * cos - p.y * sin),
          y: pos.y + (p.x * sin + p.y * cos),
        }));

        this.trainsLayer.poly(tPoints.flatMap((p) => [p.x, p.y]));
        this.trainsLayer.fill(lineColor);
        this.trainsLayer.stroke({ width: 1, color: 0x000000 });
      }
    }
  }

  /**
   * Get exact pixel position and angle of a train
   */
  private getTrainPosition(
    train: Train,
    lineIndex: number,
    segmentMap: Map<string, SegmentSharingInfo>,
  ): { x: number; y: number; angle: number } | null {
    if (!train.currentSegment) return null;

    // Find current waypoint based on progress
    // We need to map linear progress (0-1) to the polyline waypoints
    const totalDist = train.totalLength * train.progress;
    let currentDist = 0;

    const waypoints = train.currentSegment.waypoints;

    // Calculate line offset (same logic as drawLines)
    const segmentKey = createSegmentKey(
      train.currentSegment.fromStation.id,
      train.currentSegment.toStation.id,
    );
    const sharingInfo = segmentMap.get(segmentKey);
    let offsetX = 0;
    let offsetY = 0;

    if (sharingInfo && sharingInfo.lineIndices.length > 1) {
      const totalLines = sharingInfo.lineIndices.length;
      const positionInList = sharingInfo.lineIndices.indexOf(lineIndex);
      const centerOffset = (totalLines - 1) / 2;
      const normalizedPosition = positionInList - centerOffset;
      const offsetAmount = (normalizedPosition * LINE_OFFSET) / TILE_SIZE;

      if (sharingInfo.orientation === "HORIZONTAL") {
        offsetY = offsetAmount;
      } else if (sharingInfo.orientation === "VERTICAL") {
        offsetX = offsetAmount;
      } else {
        const dx =
          train.currentSegment.toStation.vertexX -
          train.currentSegment.fromStation.vertexX;
        const dy =
          train.currentSegment.toStation.vertexY -
          train.currentSegment.fromStation.vertexY;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          offsetX = (-dy / length) * offsetAmount;
          offsetY = (dx / length) * offsetAmount;
        }
      }
    }

    // Traverse waypoints to find current segment of the path
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      // Adjust for bends?
      // For simplicity, we treat the path as linear segments between waypoints.
      // We are NOT following the Bezier curves precisely because calculating distance along Bezier is expensive.
      // The visual discrepancy is small for fast trains.
      // However, we should apply the offsets.

      const p1x = p1.x + offsetX;
      const p1y = p1.y + offsetY;
      const p2x = p2.x + offsetX;
      const p2y = p2.y + offsetY;

      const dist = Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2));

      if (currentDist + dist >= totalDist) {
        // Train is on this segment
        const segmentProgress = (totalDist - currentDist) / dist;
        const x = p1x + (p2x - p1x) * segmentProgress;
        const y = p1y + (p2y - p1y) * segmentProgress;
        const angle = Math.atan2(p2y - p1y, p2x - p1x);

        return {
          x: x * TILE_SIZE,
          y: y * TILE_SIZE,
          angle,
        };
      }

      currentDist += dist;
    }

    // Fallback to end
    const last = waypoints[waypoints.length - 1];
    return {
      x: (last.x + offsetX) * TILE_SIZE,
      y: (last.y + offsetY) * TILE_SIZE,
      angle: 0,
    };
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
    this.drawStations();
    this.drawLines(); // Now implemented

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
   * Draw all stations
   */
  private drawStations(): void {
    this.stationsLayer.clear();

    for (const station of this.gameState.stations) {
      const px = station.vertexX * TILE_SIZE;
      const py = station.vertexY * TILE_SIZE;

      this.stationsLayer.circle(px, py, STATION_RADIUS);
      this.stationsLayer.fill(STATION_COLOR);

      this.stationsLayer.circle(px, py, STATION_RADIUS);
      this.stationsLayer.stroke({
        width: STATION_BORDER_WIDTH,
        color: STATION_BORDER_COLOR,
      });
    }
  }

  // --- Line Drawing Methods (Copied & Adapted) ---

  private buildSegmentSharingMap(): Map<string, SegmentSharingInfo> {
    const segmentMap = new Map<string, SegmentSharingInfo>();

    this.gameState.lines.forEach((line, lineIndex) => {
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const fromId = line.stationIds[i];
        const toId = line.stationIds[i + 1];
        const key = createSegmentKey(fromId, toId);

        if (!segmentMap.has(key)) {
          const fromStation = this.gameState.stations.find(
            (s) => s.id === fromId,
          );
          const toStation = this.gameState.stations.find((s) => s.id === toId);

          let orientation: "HORIZONTAL" | "VERTICAL" | "DIAGONAL" =
            "HORIZONTAL";
          if (fromStation && toStation) {
            const dx = toStation.vertexX - fromStation.vertexX;
            const dy = toStation.vertexY - fromStation.vertexY;
            orientation = getSegmentOrientation(dx, dy);
          }
          segmentMap.set(key, { lineIndices: [], orientation });
        }
        segmentMap.get(key)!.lineIndices.push(lineIndex);
      }
    });
    return segmentMap;
  }

  private drawLines(): void {
    this.linesLayer.clear();
    const segmentMap = this.buildSegmentSharingMap();

    this.gameState.lines.forEach((line, lineIndex) => {
      this.drawLine(line, lineIndex, segmentMap);
    });
  }

  private drawLine(
    line: MetroLine,
    lineIndex: number,
    segmentMap: Map<string, SegmentSharingInfo>,
  ): void {
    if (line.stationIds.length < 2) return;

    const color = LINE_COLOR_HEX[line.color];

    const stations = line.stationIds
      .map((id) => this.gameState.stations.find((s) => s.id === id))
      .filter((s): s is Station => s !== undefined);

    if (stations.length < 2) return;

    const segments: LineSegment[] = [];
    const segmentOffsets: { offsetX: number; offsetY: number }[] = [];

    for (let i = 0; i < stations.length - 1; i++) {
      const from = stations[i];
      const to = stations[i + 1];

      let nextAngle: Direction | null = null;
      if (i < stations.length - 2) {
        const nextStation = stations[i + 2];
        nextAngle = calculateSnapAngle(to, nextStation);
      }

      const segment = calculateSegmentPath(from, to, nextAngle);
      segments.push(segment);

      const segmentKey = createSegmentKey(from.id, to.id);
      const sharingInfo = segmentMap.get(segmentKey);

      let offsetX = 0;
      let offsetY = 0;

      if (sharingInfo && sharingInfo.lineIndices.length > 1) {
        const totalLines = sharingInfo.lineIndices.length;
        const positionInList = sharingInfo.lineIndices.indexOf(lineIndex);
        const centerOffset = (totalLines - 1) / 2;
        const normalizedPosition = positionInList - centerOffset;
        const dx = to.vertexX - from.vertexX;
        const dy = to.vertexY - from.vertexY;
        const offsetAmount = (normalizedPosition * LINE_OFFSET) / TILE_SIZE;

        if (sharingInfo.orientation === "HORIZONTAL") {
          offsetY = offsetAmount;
        } else if (sharingInfo.orientation === "VERTICAL") {
          offsetX = offsetAmount;
        } else {
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            offsetX = (-dy / length) * offsetAmount;
            offsetY = (dx / length) * offsetAmount;
          }
        }
      }
      segmentOffsets.push({ offsetX, offsetY });
    }

    this.renderSegmentsToCanvas(segments, segmentOffsets, color);
  }

  private renderSegmentsToCanvas(
    segments: LineSegment[],
    segmentOffsets: { offsetX: number; offsetY: number }[],
    color: number,
  ): void {
    if (segments.length === 0) return;

    const lineWidth = LINE_WIDTH;
    const cornerRadius = lineWidth * 2;
    const tightness = 0.5;

    const firstOffset = segmentOffsets[0] || { offsetX: 0, offsetY: 0 };
    this.linesLayer.moveTo(
      (segments[0].waypoints[0].x + firstOffset.offsetX) * TILE_SIZE,
      (segments[0].waypoints[0].y + firstOffset.offsetY) * TILE_SIZE,
    );

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      const offset = segmentOffsets[segmentIndex] || { offsetX: 0, offsetY: 0 };
      const waypoints = segment.waypoints;

      for (let j = 0; j < waypoints.length - 1; j++) {
        const next = waypoints[j + 1];
        const nextX = (next.x + offset.offsetX) * TILE_SIZE;
        const nextY = (next.y + offset.offsetY) * TILE_SIZE;

        if (next.type === "BEND") {
          const bendWaypoint = next;
          const incomingAngle = bendWaypoint.incomingAngle ?? Direction.EAST;
          const outgoingAngle = bendWaypoint.outgoingAngle ?? Direction.EAST;

          const curve = this.createBendCurve(
            bendWaypoint,
            incomingAngle,
            outgoingAngle,
            cornerRadius,
            tightness,
          );

          this.linesLayer.lineTo(
            (curve.start.x + offset.offsetX) * TILE_SIZE,
            (curve.start.y + offset.offsetY) * TILE_SIZE,
          );

          this.linesLayer.bezierCurveTo(
            (curve.control1.x + offset.offsetX) * TILE_SIZE,
            (curve.control1.y + offset.offsetY) * TILE_SIZE,
            (curve.control2.x + offset.offsetX) * TILE_SIZE,
            (curve.control2.y + offset.offsetY) * TILE_SIZE,
            (curve.end.x + offset.offsetX) * TILE_SIZE,
            (curve.end.y + offset.offsetY) * TILE_SIZE,
          );
        } else {
          this.linesLayer.lineTo(nextX, nextY);
        }
      }
    }

    this.linesLayer.stroke({
      width: lineWidth,
      color: color,
    });
  }

  private createBendCurve(
    waypoint: Waypoint,
    incomingAngle: Direction,
    outgoingAngle: Direction,
    cornerRadius: number,
    tightness: number,
  ): {
    start: { x: number; y: number };
    control1: { x: number; y: number };
    control2: { x: number; y: number };
    end: { x: number; y: number };
  } {
    const radius = cornerRadius / TILE_SIZE;
    const inDir = DIRECTION_VECTORS[incomingAngle];
    const curveStart = {
      x: waypoint.x - radius * inDir.dx,
      y: waypoint.y - radius * inDir.dy,
    };
    const outDir = DIRECTION_VECTORS[outgoingAngle];
    const curveEnd = {
      x: waypoint.x + radius * outDir.dx,
      y: waypoint.y + radius * outDir.dy,
    };
    const controlDistance = radius * tightness;
    const control1 = {
      x: curveStart.x + controlDistance * inDir.dx,
      y: curveStart.y + controlDistance * inDir.dy,
    };
    const control2 = {
      x: curveEnd.x - controlDistance * outDir.dx,
      y: curveEnd.y - controlDistance * outDir.dy,
    };
    return { start: curveStart, control1, control2, end: curveEnd };
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
