/**
 * Metro Building Screen for MetroMap.io
 * Allows users to place stations and build metro lines
 */

import { animate } from "motion";
import { Container, Graphics, FederatedPointerEvent } from "pixi.js";

import { MapRenderer } from "../game/MapRenderer";
import type { MapGrid } from "../game/models/MapGrid";
import type { Station } from "../game/models/Station";
import { generateStationId } from "../game/models/Station";
import type { GameState } from "../game/models/GameState";
import {
  createGameState,
  addLine,
  addStation,
  saveGameState,
  clearSavedGame,
} from "../game/models/GameState";
import type { MetroLine, LineColor } from "../game/models/MetroLine";
import {
  LINE_COLORS,
  LINE_COLOR_HEX,
  generateLineId,
  canAddStationToLine,
  isLineLoop,
} from "../game/models/MetroLine";
import {
  calculateSegmentPath,
  calculateSnapAngle,
  DIRECTION_VECTORS,
  Direction,
  createSegmentKey,
  getSegmentOrientation,
} from "../game/pathfinding/LinePath";
import type { LineSegment, Waypoint } from "../game/pathfinding/LinePath";

/**
 * Information about lines sharing a segment
 */
interface SegmentSharingInfo {
  lineIndices: number[]; // Indices of lines that share this segment
  orientation: "HORIZONTAL" | "VERTICAL" | "DIAGONAL";
}
import { FlatButton } from "../ui/FlatButton";
import { Label } from "../ui/Label";

const TILE_SIZE = 16;
const STATION_RADIUS = TILE_SIZE * 0.5; // 50% of square side
const STATION_COLOR = 0xffffff;
const STATION_BORDER_COLOR = 0x000000;
const STATION_BORDER_WIDTH = 2;
const LINE_WIDTH = 4;
const LINE_OFFSET = 4; // Offset for parallel lines

type StationMode = "NONE" | "ADDING" | "REMOVING";
type LineMode = "NONE" | "BUILDING";

export class MetroBuildingScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  private titleLabel: Label;
  private instructionLabel: Label;
  private clockLabel: Label;

  private addStationButton: FlatButton;
  private removeStationButton: FlatButton;
  private addLineButton: FlatButton;
  private completeLineButton: FlatButton;
  private resetButton: FlatButton;
  private startSimulationButton: FlatButton;
  private showResidentialButton: FlatButton;
  private showOfficeButton: FlatButton;
  private showDefaultButton: FlatButton;
  private showBothButton: FlatButton;

  private colorButtons: Map<LineColor, FlatButton> = new Map();

  private mapRenderer: MapRenderer;
  private mapContainer: Container;
  private mapBackground: Graphics;
  private linesLayer: Graphics;
  private stationsLayer: Graphics;

  private gameState!: GameState;
  private stationMode: StationMode = "NONE";
  private lineMode: LineMode = "NONE";

  // Line building state
  private currentLine: {
    color: LineColor | null;
    stationIds: string[];
  } = {
    color: null,
    stationIds: [],
  };

  constructor() {
    super();

    // Title
    this.titleLabel = new Label({
      text: "Build Your Metro",
      style: {
        fontSize: 36,
        fill: 0xffffff,
      },
    });
    this.addChild(this.titleLabel);

    // Instructions
    this.instructionLabel = new Label({
      text: "Click + Station to add stations at grid vertices",
      style: {
        fontSize: 18,
        fill: 0xcccccc,
      },
    });
    this.addChild(this.instructionLabel);

    // Clock display
    this.clockLabel = new Label({
      text: this.formatDateTime(new Date("2025-01-01T08:00:00")),
      style: {
        fontSize: 20,
        fill: 0x88ccff,
        fontFamily: "monospace",
      },
    });
    this.addChild(this.clockLabel);

    // Map display container
    this.mapContainer = new Container();
    this.addChild(this.mapContainer);

    // Map background (border)
    this.mapBackground = new Graphics();
    this.mapContainer.addChild(this.mapBackground);

    // Map renderer
    this.mapRenderer = new MapRenderer();
    this.mapContainer.addChild(this.mapRenderer);

    // Lines layer (drawn between map and stations)
    this.linesLayer = new Graphics();
    this.mapContainer.addChild(this.linesLayer);

    // Stations layer (drawn on top of lines)
    this.stationsLayer = new Graphics();
    this.mapContainer.addChild(this.stationsLayer);

    // Make map interactive
    this.mapContainer.eventMode = "static";
    this.mapContainer.on("pointerdown", this.onMapClick.bind(this));

    // Add station button
    this.addStationButton = new FlatButton({
      text: "+ Station",
      width: 120,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x4a90e2,
    });
    this.addStationButton.onPress.connect(() =>
      this.toggleStationMode("ADDING"),
    );
    this.addChild(this.addStationButton);

    // Remove station button
    this.removeStationButton = new FlatButton({
      text: "- Station",
      width: 120,
      height: 50,
      fontSize: 18,
      backgroundColor: 0xe74c3c,
    });
    this.removeStationButton.onPress.connect(() =>
      this.toggleStationMode("REMOVING"),
    );
    this.addChild(this.removeStationButton);

    // Add line button
    this.addLineButton = new FlatButton({
      text: "+ Line",
      width: 100,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x9b59b6,
    });
    this.addLineButton.onPress.connect(() => this.startBuildingLine());
    this.addChild(this.addLineButton);

    // Complete line button
    this.completeLineButton = new FlatButton({
      text: "Complete",
      width: 100,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x27ae60,
    });
    this.completeLineButton.onPress.connect(() => this.completeLine());
    this.completeLineButton.visible = false;
    this.addChild(this.completeLineButton);

    // Reset button (top right)
    this.resetButton = new FlatButton({
      text: "Reset",
      width: 100,
      height: 40,
      fontSize: 16,
      backgroundColor: 0xe74c3c,
    });
    this.resetButton.onPress.connect(() => this.resetGame());
    this.addChild(this.resetButton);

    // Start Simulation button
    this.startSimulationButton = new FlatButton({
      text: "Start Simulation",
      width: 160,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x22aa66,
    });
    this.startSimulationButton.onPress.connect(() => this.startSimulation());
    this.addChild(this.startSimulationButton);

    // Create color picker buttons
    this.createColorButtons();

    // Visualization mode buttons
    this.showDefaultButton = new FlatButton({
      text: "Default",
      width: 100,
      height: 40,
      fontSize: 16,
      backgroundColor: 0x666666,
    });
    this.showDefaultButton.onPress.connect(() =>
      this.setVisualizationMode("DEFAULT"),
    );
    this.addChild(this.showDefaultButton);

    this.showResidentialButton = new FlatButton({
      text: "Residential",
      width: 120,
      height: 40,
      fontSize: 16,
      backgroundColor: 0x44aa44,
    });
    this.showResidentialButton.onPress.connect(() =>
      this.setVisualizationMode("RESIDENTIAL"),
    );
    this.addChild(this.showResidentialButton);

    this.showOfficeButton = new FlatButton({
      text: "Office",
      width: 100,
      height: 40,
      fontSize: 16,
      backgroundColor: 0xcc4444,
    });
    this.showOfficeButton.onPress.connect(() =>
      this.setVisualizationMode("OFFICE"),
    );
    this.addChild(this.showOfficeButton);

    this.showBothButton = new FlatButton({
      text: "Both",
      width: 100,
      height: 40,
      fontSize: 16,
      backgroundColor: 0x8855aa,
    });
    this.showBothButton.onPress.connect(() =>
      this.setVisualizationMode("BOTH"),
    );
    this.addChild(this.showBothButton);
  }

  /**
   * Create color picker buttons for line creation
   */
  private createColorButtons(): void {
    LINE_COLORS.forEach((color) => {
      const button = new FlatButton({
        text: color.charAt(0).toUpperCase() + color.slice(1),
        width: 80,
        height: 35,
        fontSize: 14,
        backgroundColor: LINE_COLOR_HEX[color],
      });
      button.onPress.connect(() => this.selectLineColor(color));
      button.visible = false; // Hidden until line building starts
      this.addChild(button);
      this.colorButtons.set(color, button);
    });
  }

  /**
   * Start building a new line
   */
  private startBuildingLine(): void {
    if (this.lineMode === "BUILDING") return;

    // Reset station modes
    this.stationMode = "NONE";
    this.lineMode = "BUILDING";

    // Reset current line
    this.currentLine = {
      color: null,
      stationIds: [],
    };

    // Show color picker
    this.showColorPicker();

    // Update UI
    this.addLineButton.alpha = 0.6;
    this.addStationButton.alpha = 0.6;
    this.removeStationButton.alpha = 0.6;
    this.instructionLabel.text = "Select a color for your new line";
  }

  /**
   * Show color picker buttons
   */
  private showColorPicker(): void {
    const usedColors = new Set(this.gameState.lines.map((l) => l.color));

    this.colorButtons.forEach((button, color) => {
      const isUsed = usedColors.has(color);
      button.visible = true;
      button.alpha = isUsed ? 0.3 : 1.0;
      button.eventMode = isUsed ? "none" : "static";
    });
  }

  /**
   * Hide color picker buttons
   */
  private hideColorPicker(): void {
    this.colorButtons.forEach((button) => {
      button.visible = false;
    });
  }

  /**
   * Select a color for the current line
   */
  private selectLineColor(color: LineColor): void {
    this.currentLine.color = color;
    this.hideColorPicker();
    this.completeLineButton.visible = true;
    this.instructionLabel.text =
      "Click stations to build your line, then click Complete";
  }

  /**
   * Complete the current line
   */
  private completeLine(): void {
    if (!this.currentLine.color || this.currentLine.stationIds.length < 2) {
      console.log("Need at least 2 stations to complete a line");
      return;
    }

    // Create the line
    const line: MetroLine = {
      id: generateLineId(),
      color: this.currentLine.color,
      stationIds: this.currentLine.stationIds,
      isLoop: isLineLoop(this.currentLine.stationIds),
      trains: [],
    };

    // Add line with duplicate color guard
    const success = addLine(this.gameState, line);
    if (!success) {
      this.instructionLabel.text = `Error: ${line.color} line already exists!`;
      return;
    }

    console.log(
      `Created ${line.color} line with ${line.stationIds.length} stations`,
    );

    // Reset state
    this.lineMode = "NONE";
    this.currentLine = { color: null, stationIds: [] };
    this.completeLineButton.visible = false;
    this.addLineButton.alpha = 1.0;
    this.addStationButton.alpha = 0.8;
    this.removeStationButton.alpha = 0.8;
    this.instructionLabel.text = "Click + or - to add or remove stations";

    // Redraw
    this.drawLines();
  }

  /**
   * Reset the game - clear save and return to map picker
   */
  private async resetGame(): Promise<void> {
    // Clear saved game
    clearSavedGame();
    console.log("Game reset - saved data cleared");

    // Import MapPickerScreen dynamically to avoid circular dependency
    const { MapPickerScreen } = await import("./MapPickerScreen");
    const { engine } = await import("../getEngine");

    // Navigate back to map picker
    await engine().navigation.showScreen(MapPickerScreen);
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
   * Start the simulation
   */
  private async startSimulation(): Promise<void> {
    // Save current state
    saveGameState(this.gameState);

    // Import and navigate to simulation screen
    const { MetroSimulationScreen } = await import("./MetroSimulationScreen");
    const { engine } = await import("../getEngine");

    await engine().navigation.showScreen(MetroSimulationScreen);
    const screen = engine().navigation.currentScreen as InstanceType<
      typeof MetroSimulationScreen
    >;
    if (screen && screen.setGameState) {
      screen.setGameState(this.gameState);
      screen.startSimulation();
    }
  }

  /**
   * Set the map to display
   */
  public setMap(map: MapGrid): void {
    // Initialize game state
    this.gameState = createGameState(map.seed, map);
    this.mapRenderer.renderMap(map);
    this.drawMapBackground();
    this.drawLines();

    // Update clock display
    const time =
      this.gameState.simulationTime ||
      new Date("2025-01-01T08:00:00").getTime();
    const currentDate = new Date(time);
    this.clockLabel.text = this.formatDateTime(currentDate);
  }

  /**
   * Load game state (for restoring saved game)
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
    this.drawLines();

    // Update clock display
    const currentDate = new Date(this.gameState.simulationTime);
    this.clockLabel.text = this.formatDateTime(currentDate);
  }

  /**
   * Toggle station mode (adding/removing)
   */
  private toggleStationMode(mode: "ADDING" | "REMOVING"): void {
    // If clicking the same mode, turn it off
    if (this.stationMode === mode) {
      this.stationMode = "NONE";
      this.addStationButton.alpha = 0.8;
      this.removeStationButton.alpha = 0.8;
      this.addStationButton.textView = "+ Station";
      this.removeStationButton.textView = "- Station";
      this.instructionLabel.text = "Click + or - to add or remove stations";
    } else {
      this.stationMode = mode;

      if (mode === "ADDING") {
        this.addStationButton.alpha = 1.0;
        this.removeStationButton.alpha = 0.8;
        this.addStationButton.textView = "✓ Adding...";
        this.removeStationButton.textView = "- Station";
        this.instructionLabel.text = "Click on grid vertices to place stations";
      } else {
        this.addStationButton.alpha = 0.8;
        this.removeStationButton.alpha = 1.0;
        this.addStationButton.textView = "+ Station";
        this.removeStationButton.textView = "✓ Removing...";
        this.instructionLabel.text =
          "Click on existing stations to remove them";
      }
    }
  }

  /**
   * Handle map click to add or remove stations
   */
  /**
   * Handle map click to add/remove stations or build lines
   */
  private onMapClick(event: FederatedPointerEvent): void {
    // Get click position relative to map renderer
    const localPos = this.mapRenderer.toLocal(event.global);

    // Convert to vertex coordinates
    const vertexX = Math.round(localPos.x / TILE_SIZE);
    const vertexY = Math.round(localPos.y / TILE_SIZE);

    // Validate vertex is within bounds
    if (
      vertexX < 0 ||
      vertexX > this.gameState.map.width ||
      vertexY < 0 ||
      vertexY > this.gameState.map.height
    ) {
      return;
    }

    // Handle line building mode
    if (this.lineMode === "BUILDING" && this.currentLine.color) {
      this.handleLineStationClick(vertexX, vertexY);
      return;
    }

    // Handle station modes
    if (this.stationMode === "NONE") return;

    if (this.stationMode === "ADDING") {
      this.handleAddStation(vertexX, vertexY);
    } else if (this.stationMode === "REMOVING") {
      this.handleRemoveStation(vertexX, vertexY);
    }
  }

  /**
   * Handle clicking a station while building a line
   */
  private handleLineStationClick(vertexX: number, vertexY: number): void {
    const stationId = generateStationId(vertexX, vertexY);

    // Check if this vertex has a station
    if (!this.hasStationAt(vertexX, vertexY)) {
      console.log("No station at this vertex");
      return;
    }

    // Check if we can add this station to the line
    if (!canAddStationToLine(this.currentLine.stationIds, stationId)) {
      console.log("Station already in line (or would create invalid path)");
      return;
    }

    // Add station to line
    this.currentLine.stationIds.push(stationId);
    console.log(`Added station ${stationId} to line`);

    // Check if we closed a loop
    if (
      this.currentLine.stationIds.length > 2 &&
      stationId === this.currentLine.stationIds[0]
    ) {
      console.log("Loop closed!");
    }

    // Redraw to show progress
    this.drawLines();
  }

  /**
   * Handle adding a station
   */
  private handleAddStation(vertexX: number, vertexY: number): void {
    // Check if station already exists at this vertex
    if (this.hasStationAt(vertexX, vertexY)) {
      console.log("Station already exists at this vertex");
      return;
    }

    // Check if any adjacent vertex has a station (minimum spacing rule)
    if (this.hasAdjacentStation(vertexX, vertexY)) {
      console.log("Cannot place station adjacent to another station");
      return;
    }

    // Add the station
    this.addStationAtVertex(vertexX, vertexY);
  }

  /**
   * Handle removing a station
   */
  private handleRemoveStation(vertexX: number, vertexY: number): void {
    const stationId = generateStationId(vertexX, vertexY);
    const index = this.gameState.stations.findIndex((s) => s.id === stationId);

    if (index === -1) {
      console.log("No station at this vertex");
      return;
    }

    // Remove the station
    this.gameState.stations.splice(index, 1);
    console.log(`Removed station at vertex (${vertexX}, ${vertexY})`);

    // Save state after removal
    saveGameState(this.gameState);

    // Redraw stations
    this.drawStations();
  }

  /**
   * Check if a station exists at given vertex
   */
  private hasStationAt(vertexX: number, vertexY: number): boolean {
    const stationId = generateStationId(vertexX, vertexY);
    return this.gameState.stations.some((s) => s.id === stationId);
  }

  /**
   * Check if any adjacent vertex (4-connected) has a station
   */
  private hasAdjacentStation(vertexX: number, vertexY: number): boolean {
    const adjacentVertices = [
      { x: vertexX - 1, y: vertexY }, // left
      { x: vertexX + 1, y: vertexY }, // right
      { x: vertexX, y: vertexY - 1 }, // up
      { x: vertexX, y: vertexY + 1 }, // down
    ];

    return adjacentVertices.some((v) => this.hasStationAt(v.x, v.y));
  }

  /**
   * Add a station at the given vertex
   */
  private addStationAtVertex(vertexX: number, vertexY: number): void {
    const station: Station = {
      id: generateStationId(vertexX, vertexY),
      vertexX,
      vertexY,
    };

    addStation(this.gameState, station);
    console.log(
      `Added station ${station.id} at vertex (${vertexX}, ${vertexY})`,
    );

    // Redraw stations
    this.drawStations();
  }

  /**
   * Draw all stations
   */
  private drawStations(): void {
    this.stationsLayer.clear();

    for (const station of this.gameState.stations) {
      const px = station.vertexX * TILE_SIZE;
      const py = station.vertexY * TILE_SIZE;

      // Draw station circle
      this.stationsLayer.circle(px, py, STATION_RADIUS);
      this.stationsLayer.fill(STATION_COLOR);

      // Draw border
      this.stationsLayer.circle(px, py, STATION_RADIUS);
      this.stationsLayer.stroke({
        width: STATION_BORDER_WIDTH,
        color: STATION_BORDER_COLOR,
      });
    }
  }

  /**
   * Build a map of which segments are shared by which lines
   * Returns a map: segmentKey -> { lineIndices, orientation }
   */
  private buildSegmentSharingMap(): Map<string, SegmentSharingInfo> {
    const segmentMap = new Map<string, SegmentSharingInfo>();

    // Process all completed lines
    this.gameState.lines.forEach((line, lineIndex) => {
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const fromId = line.stationIds[i];
        const toId = line.stationIds[i + 1];
        const key = createSegmentKey(fromId, toId);

        if (!segmentMap.has(key)) {
          // Calculate orientation based on station positions
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

    // Also include the current line being built
    if (
      this.lineMode === "BUILDING" &&
      this.currentLine.color &&
      this.currentLine.stationIds.length > 1
    ) {
      const tempLineIndex = this.gameState.lines.length;
      for (let i = 0; i < this.currentLine.stationIds.length - 1; i++) {
        const fromId = this.currentLine.stationIds[i];
        const toId = this.currentLine.stationIds[i + 1];
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

        segmentMap.get(key)!.lineIndices.push(tempLineIndex);
      }
    }

    return segmentMap;
  }

  /**
   * Draw all metro lines
   */
  private drawLines(): void {
    this.linesLayer.clear();

    // Build the segment sharing map
    const segmentMap = this.buildSegmentSharingMap();

    // Draw completed lines
    this.gameState.lines.forEach((line, lineIndex) => {
      this.drawLine(line, lineIndex, segmentMap, false);
    });

    // Draw current line being built
    if (
      this.lineMode === "BUILDING" &&
      this.currentLine.color &&
      this.currentLine.stationIds.length > 0
    ) {
      const tempLine: MetroLine = {
        id: "temp",
        color: this.currentLine.color,
        stationIds: this.currentLine.stationIds,
        isLoop: false,
        trains: [],
      };
      this.drawLine(tempLine, this.gameState.lines.length, segmentMap, true);
    }
  }

  /**
   * Draw a single metro line using Harry Beck style rendering
   */
  private drawLine(
    line: MetroLine,
    lineIndex: number,
    segmentMap: Map<string, SegmentSharingInfo>,
    isTemp: boolean = false,
  ): void {
    if (line.stationIds.length < 2) return;

    const color = LINE_COLOR_HEX[line.color];

    // Get station objects
    const stations = line.stationIds
      .map((id) => this.gameState.stations.find((s) => s.id === id))
      .filter((s): s is Station => s !== undefined);

    if (stations.length < 2) return;

    // Calculate all segments with waypoints and their offsets
    const segments: LineSegment[] = [];
    const segmentOffsets: { offsetX: number; offsetY: number }[] = [];

    for (let i = 0; i < stations.length - 1; i++) {
      const from = stations[i];
      const to = stations[i + 1];

      // Look ahead to the next segment to optimize angles at intermediate stations
      let nextAngle: Direction | null = null;
      if (i < stations.length - 2) {
        const nextStation = stations[i + 2];
        nextAngle = calculateSnapAngle(to, nextStation);
      }

      const segment = calculateSegmentPath(from, to, nextAngle);
      segments.push(segment);

      // Calculate offset for this segment based on sharing info
      const segmentKey = createSegmentKey(from.id, to.id);
      const sharingInfo = segmentMap.get(segmentKey);

      let offsetX = 0;
      let offsetY = 0;

      if (sharingInfo && sharingInfo.lineIndices.length > 1) {
        const totalLines = sharingInfo.lineIndices.length;
        const positionInList = sharingInfo.lineIndices.indexOf(lineIndex);

        // Center the lines: positions range from -(n-1)/2 to +(n-1)/2
        const centerOffset = (totalLines - 1) / 2;
        const normalizedPosition = positionInList - centerOffset;

        // Apply offset based on segment orientation (horizontal/vertical/diagonal)
        // This uses the OVERALL direction from source to destination, not individual legs
        const dx = to.vertexX - from.vertexX;
        const dy = to.vertexY - from.vertexY;

        // Scale the offset (LINE_OFFSET is in pixels, convert to grid units)
        const offsetAmount = (normalizedPosition * LINE_OFFSET) / TILE_SIZE;

        // For horizontal segments, offset in Y; for vertical, offset in X
        // For diagonal, offset perpendicular to the diagonal
        if (sharingInfo.orientation === "HORIZONTAL") {
          // Horizontal segment: offset vertically
          offsetY = offsetAmount;
        } else if (sharingInfo.orientation === "VERTICAL") {
          // Vertical segment: offset horizontally
          offsetX = offsetAmount;
        } else {
          // Diagonal segment: offset perpendicular
          // Perpendicular to (dx, dy) is (-dy, dx) normalized
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            offsetX = (-dy / length) * offsetAmount;
            offsetY = (dx / length) * offsetAmount;
          }
        }
      }

      segmentOffsets.push({ offsetX, offsetY });
    }

    // Render the complete line with offsets
    this.renderSegmentsToCanvas(segments, segmentOffsets, color, isTemp);
  }

  /**
   * Render line segments to canvas with bezier curves at bends
   * Each segment can have its own offset for parallel line rendering
   */
  private renderSegmentsToCanvas(
    segments: LineSegment[],
    segmentOffsets: { offsetX: number; offsetY: number }[],
    color: number,
    isTemp: boolean,
  ): void {
    if (segments.length === 0) return;

    const lineWidth = LINE_WIDTH;
    const cornerRadius = lineWidth * 2;
    const tightness = 0.5;

    // Start at first waypoint with offset
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

        // Convert to pixel coordinates with offset
        const nextX = (next.x + offset.offsetX) * TILE_SIZE;
        const nextY = (next.y + offset.offsetY) * TILE_SIZE;

        if (next.type === "BEND") {
          // Approaching a bend - draw line to curve start, then the curve
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

          // Line to curve start (with offset)
          this.linesLayer.lineTo(
            (curve.start.x + offset.offsetX) * TILE_SIZE,
            (curve.start.y + offset.offsetY) * TILE_SIZE,
          );

          // Cubic bezier curve (with offset)
          this.linesLayer.bezierCurveTo(
            (curve.control1.x + offset.offsetX) * TILE_SIZE,
            (curve.control1.y + offset.offsetY) * TILE_SIZE,
            (curve.control2.x + offset.offsetX) * TILE_SIZE,
            (curve.control2.y + offset.offsetY) * TILE_SIZE,
            (curve.end.x + offset.offsetX) * TILE_SIZE,
            (curve.end.y + offset.offsetY) * TILE_SIZE,
          );
        } else {
          // Straight line segment (either leaving a bend or between stations)
          this.linesLayer.lineTo(nextX, nextY);
        }
      }
    }

    this.linesLayer.stroke({
      width: lineWidth,
      color: color,
      alpha: isTemp ? 0.6 : 1.0,
    });
  }

  /**
   * Create bezier curve for a bend
   */
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
    const radius = cornerRadius / TILE_SIZE; // Convert to grid units

    // Calculate where curve starts (along incoming direction)
    const inDir = DIRECTION_VECTORS[incomingAngle];
    const curveStart = {
      x: waypoint.x - radius * inDir.dx,
      y: waypoint.y - radius * inDir.dy,
    };

    // Calculate where curve ends (along outgoing direction)
    const outDir = DIRECTION_VECTORS[outgoingAngle];
    const curveEnd = {
      x: waypoint.x + radius * outDir.dx,
      y: waypoint.y + radius * outDir.dy,
    };

    // Calculate control points for smooth curve
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
   * Set visualization mode
   */
  private setVisualizationMode(
    mode: "DEFAULT" | "RESIDENTIAL" | "OFFICE" | "BOTH",
  ): void {
    this.mapRenderer.setVisualizationMode(mode);

    // Update button styles to show active state
    const activeOpacity = 1.0;
    const inactiveOpacity = 0.6;

    this.showDefaultButton.alpha =
      mode === "DEFAULT" ? activeOpacity : inactiveOpacity;
    this.showResidentialButton.alpha =
      mode === "RESIDENTIAL" ? activeOpacity : inactiveOpacity;
    this.showOfficeButton.alpha =
      mode === "OFFICE" ? activeOpacity : inactiveOpacity;
    this.showBothButton.alpha =
      mode === "BOTH" ? activeOpacity : inactiveOpacity;
  }

  /**
   * Draw background/border for the map
   */
  private drawMapBackground(): void {
    this.mapBackground.clear();

    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();
    const padding = 4;

    // Border
    this.mapBackground.roundRect(
      -padding,
      -padding,
      mapWidth + padding * 2,
      mapHeight + padding * 2,
      4,
    );
    this.mapBackground.fill({ color: 0x333333 });
  }

  /** Prepare the screen just before showing */
  public prepare() {
    // Reset to initial state if needed
  }

  /** Update the screen */
  public update() {
    // No per-frame updates needed for this screen
  }

  /** Pause gameplay */
  public async pause() {}

  /** Resume gameplay */
  public async resume() {}

  /** Fully reset */
  public reset() {}

  /** Resize the screen */
  public resize(width: number, height: number) {
    const centerX = width * 0.5;

    // Title at top
    this.titleLabel.x = centerX;
    this.titleLabel.y = 30;

    // Clock at top right (left of reset button)
    this.clockLabel.x = width - 280;
    this.clockLabel.y = 35;

    // Reset button at top right
    this.resetButton.x = width - 120;
    this.resetButton.y = 30;

    // Instructions below title
    this.instructionLabel.x = centerX;
    this.instructionLabel.y = 70;

    // Control buttons at bottom
    const bottomY = height - 100;

    // Station control buttons
    this.addStationButton.x = centerX - 380;
    this.addStationButton.y = bottomY;

    this.removeStationButton.x = centerX - 250;
    this.removeStationButton.y = bottomY;

    // Line control buttons
    this.addLineButton.x = centerX - 120;
    this.addLineButton.y = bottomY;

    this.completeLineButton.x = centerX - 10;
    this.completeLineButton.y = bottomY;

    // Color picker buttons (arranged in a row above main buttons)
    const colorY = bottomY - 50;
    let colorX = centerX - 480;
    this.colorButtons.forEach((button) => {
      button.x = colorX;
      button.y = colorY;
      colorX += 85;
    });

    // Visualization mode buttons on right
    this.showDefaultButton.x = centerX + 100;
    this.showDefaultButton.y = bottomY;

    this.showResidentialButton.x = centerX + 210;
    this.showResidentialButton.y = bottomY;

    this.showOfficeButton.x = centerX + 330;
    this.showOfficeButton.y = bottomY;

    this.showBothButton.x = centerX + 440;
    this.showBothButton.y = bottomY;

    // Start Simulation button (center bottom, below other controls)
    this.startSimulationButton.x = centerX - 80;
    this.startSimulationButton.y = bottomY + 60;

    // Map display - centered
    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();

    // Scale map to fit if needed
    const mapStartY = 110;
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
    // Fade in all elements
    const elementsToAnimate = [
      this.titleLabel,
      this.instructionLabel,
      this.clockLabel,
      this.addStationButton,
      this.removeStationButton,
      this.addLineButton,
      this.resetButton,
      this.startSimulationButton,
      this.showDefaultButton,
      this.showResidentialButton,
      this.showOfficeButton,
      this.showBothButton,
      this.mapContainer,
    ];

    for (const element of elementsToAnimate) {
      element.alpha = 0;
    }

    await animate(
      elementsToAnimate,
      { alpha: 1 },
      { duration: 0.4, ease: "easeOut" },
    );
  }

  /** Hide screen with animations */
  public async hide() {
    // Navigation handles cleanup
  }

  /** Handle window blur */
  public blur() {}

  /** Handle window focus */
  public focus() {}

  /**
   * Get the current game state
   */
  public getGameState(): GameState {
    return this.gameState;
  }
}
