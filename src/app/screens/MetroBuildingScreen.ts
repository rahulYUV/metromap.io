/**
 * Metro Building Screen for MetroMap.io
 * Allows users to place stations and build metro lines
 */

import { animate } from "motion";
import { Container, Graphics, FederatedPointerEvent } from "pixi.js";

import { MapRenderer } from "../game/MapRenderer";
import { MetroRenderer } from "../game/MetroRenderer";
import { TILE_SIZE } from "../game/config";
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
import type { Train } from "../game/models/Train";
import { FlatButton } from "../ui/FlatButton";
import { Label } from "../ui/Label";
import { formatMoney } from "../game/simulation/Economics";

type StationMode = "NONE" | "ADDING" | "REMOVING";
type LineMode = "NONE" | "BUILDING";

export class MetroBuildingScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  private titleLabel: Label;
  private instructionLabel: Label;
  private moneyLabel: Label;
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

  // Line management UI
  private lineListContainer: Container;
  private lineListBackground: Graphics;
  private lineItemsContainer: Container;
  private lineControls: Map<
    string,
    {
      container: Container;
      label: Label;
      countLabel: Label;
      minusButton: FlatButton;
      plusButton: FlatButton;
    }
  > = new Map();

  private mapRenderer: MapRenderer;
  private metroRenderer: MetroRenderer;
  private mapContainer: Container;
  private mapBackground: Graphics;

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

    // Money display (before clock)
    this.moneyLabel = new Label({
      text: "$10000",
      style: {
        fontSize: 24,
        fill: 0x00ff00, // Green for positive money
        fontFamily: "monospace",
        fontWeight: "bold",
      },
    });
    this.addChild(this.moneyLabel);

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

    // Metro Renderer (handles lines and stations)
    this.metroRenderer = new MetroRenderer();
    this.mapContainer.addChild(this.metroRenderer);

    // Make map interactive
    this.mapContainer.eventMode = "static";
    this.mapContainer.on("pointerdown", this.onMapClick.bind(this));

    // Line list container (left side panel)
    this.lineListContainer = new Container();
    this.addChild(this.lineListContainer);

    this.lineListBackground = new Graphics();
    this.lineListContainer.addChild(this.lineListBackground);

    this.lineItemsContainer = new Container();
    this.lineListContainer.addChild(this.lineItemsContainer);

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

    // Create the line with 1 initial train
    const line: MetroLine = {
      id: generateLineId(),
      color: this.currentLine.color,
      stationIds: this.currentLine.stationIds,
      isLoop: isLineLoop(this.currentLine.stationIds),
      trains: [],
    };

    // Add the first train to the line
    const train = this.createTrainForLine(line, 1, 0);
    line.trains.push(train);

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
    this.updateMetroRenderer();
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
   * Update money display with color coding
   */
  private updateMoneyDisplay(): void {
    const money = this.gameState?.money ?? 0;
    const { text, color } = formatMoney(money);
    this.moneyLabel.text = text;
    this.moneyLabel.style.fill = color;
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
    this.updateMetroRenderer();

    // Update clock display
    const time =
      this.gameState.simulationTime ||
      new Date("2025-01-01T08:00:00").getTime();
    const currentDate = new Date(time);
    this.clockLabel.text = this.formatDateTime(currentDate);

    // Update money display
    this.updateMoneyDisplay();
  }

  /**
   * Load game state (for restoring saved game)
   */
  public setGameState(gameState: GameState): void {
    if (!gameState) {
      console.error(
        "MetroBuildingScreen.setGameState called with undefined gameState",
      );
      return;
    }
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
    this.updateMetroRenderer();

    // Update clock display
    const currentDate = new Date(this.gameState.simulationTime);
    this.clockLabel.text = this.formatDateTime(currentDate);

    // Update money display
    this.updateMoneyDisplay();
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
    this.updateMetroRenderer();
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
    this.updateMetroRenderer();
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
      passengers: [],
      label: "", // Will be assigned by addStation()
    };

    addStation(this.gameState, station);
    console.log(
      `Added station ${station.id} (${station.label}) at vertex (${vertexX}, ${vertexY})`,
    );

    // Redraw stations
    this.updateMetroRenderer();
  }

  /**
   * Update all metro visual elements
   */
  private updateMetroRenderer(): void {
    this.metroRenderer.renderStations(this.gameState.stations);

    // Prepare temp line if needed
    let tempLine: MetroLine | undefined;
    if (
      this.lineMode === "BUILDING" &&
      this.currentLine.color &&
      this.currentLine.stationIds.length > 0
    ) {
      tempLine = {
        id: "temp",
        color: this.currentLine.color,
        stationIds: this.currentLine.stationIds,
        isLoop: false,
        trains: [],
      };
    }

    this.metroRenderer.renderLines(
      this.gameState.lines,
      this.gameState.stations,
      tempLine,
    );

    // Update line list UI
    this.updateLineList();
  }

  /**
   * Update the line list panel showing built lines with train controls
   */
  private updateLineList(): void {
    // Clear existing line items
    this.lineItemsContainer.removeChildren();
    this.lineControls.clear();

    const itemHeight = 60;
    const itemSpacing = 10;
    let yOffset = 10;

    for (const line of this.gameState.lines) {
      const trainCount = line.trains.length;

      // Create container for this line item
      const itemContainer = new Container();
      itemContainer.y = yOffset;

      // Background
      const bg = new Graphics();
      bg.roundRect(0, 0, 250, itemHeight - 5, 8);
      bg.fill(LINE_COLOR_HEX[line.color]);
      bg.alpha = 0.3;
      itemContainer.addChild(bg);

      // Line label (e.g., "Red Line")
      const lineLabel = new Label({
        text: `${line.color.charAt(0).toUpperCase() + line.color.slice(1)} Line`,
        style: {
          fontSize: 16,
          fill: 0xffffff,
          fontWeight: "bold",
        },
      });
      lineLabel.anchor.set(0, 0.5);
      lineLabel.x = 10;
      lineLabel.y = (itemHeight - 5) / 2 - 10;
      itemContainer.addChild(lineLabel);

      // Train count label
      const countLabel = new Label({
        text: `Trains: ${trainCount}`,
        style: {
          fontSize: 14,
          fill: 0xcccccc,
        },
      });
      countLabel.anchor.set(0, 0.5);
      countLabel.x = 10;
      countLabel.y = (itemHeight - 5) / 2 + 10;
      itemContainer.addChild(countLabel);

      // Minus button
      const minusButton = new FlatButton({
        text: "-",
        width: 30,
        height: 30,
        fontSize: 20,
        backgroundColor: 0xe74c3c,
      });
      minusButton.x = 170;
      minusButton.y = (itemHeight - 5) / 2;
      minusButton.onPress.connect(() => this.decreaseTrainCount(line.id));
      minusButton.alpha = trainCount > 1 ? 1.0 : 0.3;
      minusButton.eventMode = trainCount > 1 ? "static" : "none";
      itemContainer.addChild(minusButton);

      // Plus button
      const plusButton = new FlatButton({
        text: "+",
        width: 30,
        height: 30,
        fontSize: 20,
        backgroundColor: 0x27ae60,
      });
      plusButton.x = 215;
      plusButton.y = (itemHeight - 5) / 2;
      plusButton.onPress.connect(() => this.increaseTrainCount(line.id));
      plusButton.alpha = trainCount < 5 ? 1.0 : 0.3;
      plusButton.eventMode = trainCount < 5 ? "static" : "none";
      itemContainer.addChild(plusButton);

      this.lineItemsContainer.addChild(itemContainer);

      // Store references for updates
      this.lineControls.set(line.id, {
        container: itemContainer,
        label: lineLabel,
        countLabel,
        minusButton,
        plusButton,
      });

      yOffset += itemHeight + itemSpacing;
    }
  }

  /**
   * Increase train count for a line
   */
  private increaseTrainCount(lineId: string): void {
    const line = this.gameState.lines.find((l) => l.id === lineId);
    if (!line || line.trains.length >= 5) return;

    // Get train count for direction and delay calculation
    const trainNumber = line.trains.length + 1; // 1-indexed for user display

    // Odd trains (1, 3, 5) move forward (direction 1)
    // Even trains (2, 4) move backward (direction -1)
    const direction = trainNumber % 2 === 1 ? 1 : -1;

    // Trains 3+ start with delay (half the line length)
    const startStationIdx = this.calculateStartStationIdx(
      trainNumber,
      direction,
      line.stationIds.length,
    );

    const train = this.createTrainForLine(line, direction, startStationIdx);
    line.trains.push(train);

    saveGameState(this.gameState);
    this.updateLineList();
  }

  /**
   * Calculate starting station index for a train based on train number and direction
   */
  private calculateStartStationIdx(
    trainNumber: number,
    direction: 1 | -1,
    stationCount: number,
  ): number {
    if (trainNumber <= 2) {
      return 0;
    }

    if (direction === 1) {
      return Math.floor(stationCount / 2);
    } else {
      return stationCount - 1 - Math.floor(stationCount / 2);
    }
  }

  /**
   * Decrease train count for a line
   */
  private decreaseTrainCount(lineId: string): void {
    const line = this.gameState.lines.find((l) => l.id === lineId);
    if (!line || line.trains.length <= 1) return;

    // Remove the last train
    line.trains.pop();

    saveGameState(this.gameState);
    this.updateLineList();
  }

  /**
   * Create a train for a line with specific configuration
   */
  private createTrainForLine(
    line: MetroLine,
    direction: 1 | -1,
    startStationIdx: number,
  ): Train {
    // Calculate target station index based on direction, handling edge cases
    // Note: In edge cases where target equals current (e.g., backward train at station 0),
    // the simulation will immediately trigger arrival logic, which then recalculates
    // the next valid target based on line type and direction (see TrainMovement.ts)
    let targetStationIdx: number;
    if (direction === 1) {
      // Moving forward - clamp to last station
      targetStationIdx = Math.min(
        startStationIdx + 1,
        line.stationIds.length - 1,
      );
    } else {
      // Moving backward - clamp to first station
      targetStationIdx = Math.max(startStationIdx - 1, 0);
    }

    const train: Train = {
      id: `train-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lineId: line.id,
      state: "MOVING" as const,
      dwellRemaining: 0,
      currentStationIdx: startStationIdx,
      targetStationIdx,
      progress: 0,
      direction,
      currentSegment: null,
      totalLength: 0,
      passengers: [],
      capacity: 30, // TRAIN_MAX_CAPACITY
    };

    return train;
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
    // Top Bar (Y=30)
    const topBarY = 30;

    // Title at top left
    this.titleLabel.anchor.set(0, 0.5);
    this.titleLabel.x = 20;
    this.titleLabel.y = topBarY;

    // Instructions below title
    this.instructionLabel.anchor.set(0, 0.5);
    this.instructionLabel.x = 20;
    this.instructionLabel.y = topBarY + 30;

    // Reset button at top right
    this.resetButton.x = width - 20 - this.resetButton.width / 2;
    this.resetButton.y = topBarY;

    // Clock to left of Reset Control
    this.clockLabel.anchor.set(1, 0.5);
    this.clockLabel.x = width - 130;
    this.clockLabel.y = topBarY;

    // Money display to left of clock
    this.moneyLabel.anchor.set(1, 0.5);
    this.moneyLabel.x = this.clockLabel.x - 20;
    this.moneyLabel.y = topBarY;

    // --- Controls Row 1 (Y=100) ---
    const row1Y = 100;
    const gap = 15;

    // Left: Station and Line controls
    let leftX = 20 + this.addStationButton.width / 2;

    this.addStationButton.x = leftX;
    this.addStationButton.y = row1Y;
    leftX +=
      this.addStationButton.width / 2 +
      gap +
      this.removeStationButton.width / 2;

    this.removeStationButton.x = leftX;
    this.removeStationButton.y = row1Y;
    leftX +=
      this.removeStationButton.width / 2 +
      gap * 2 +
      this.addLineButton.width / 2;

    this.addLineButton.x = leftX;
    this.addLineButton.y = row1Y;
    leftX +=
      this.addLineButton.width / 2 + gap + this.completeLineButton.width / 2;

    this.completeLineButton.x = leftX;
    this.completeLineButton.y = row1Y;

    // Right: Visualization controls
    let rightX = width - 20 - this.showBothButton.width / 2;

    this.showBothButton.x = rightX;
    this.showBothButton.y = row1Y;
    rightX -=
      this.showBothButton.width / 2 + gap + this.showOfficeButton.width / 2;

    this.showOfficeButton.x = rightX;
    this.showOfficeButton.y = row1Y;
    rightX -=
      this.showOfficeButton.width / 2 +
      gap +
      this.showResidentialButton.width / 2;

    this.showResidentialButton.x = rightX;
    this.showResidentialButton.y = row1Y;
    rightX -=
      this.showResidentialButton.width / 2 +
      gap +
      this.showDefaultButton.width / 2;

    this.showDefaultButton.x = rightX;
    this.showDefaultButton.y = row1Y;

    // --- Controls Row 2 (Y=150) ---
    const row2Y = 150;

    // Left: Color picker buttons
    let colorX = 20 + 40; // 40 is half-width
    this.colorButtons.forEach((button) => {
      button.x = colorX;
      button.y = row2Y;
      colorX += 80 + 5;
    });

    // Right: Start Simulation button
    this.startSimulationButton.x =
      width - 20 - this.startSimulationButton.width / 2;
    this.startSimulationButton.y = row2Y;

    // Line list panel (left side, below controls)
    const lineListX = 20;
    const lineListY = 200;
    const lineListWidth = 270;
    const lineListMaxHeight = height - lineListY - 10;

    this.lineListContainer.x = lineListX;
    this.lineListContainer.y = lineListY;

    // Draw background for line list
    this.lineListBackground.clear();
    if (this.gameState && this.gameState.lines.length > 0) {
      const lineListHeight = Math.min(
        lineListMaxHeight,
        this.gameState.lines.length * 70 + 20,
      );
      this.lineListBackground.roundRect(0, 0, lineListWidth, lineListHeight, 8);
      this.lineListBackground.fill({ color: 0x222222, alpha: 0.8 });
      this.lineListBackground.stroke({ color: 0x444444, width: 2 });
    }

    // Map display - adjust to make room for line list on the left
    const mapStartY = 190;
    const mapBottomMargin = 10;
    const mapLeftMargin = lineListWidth + 40; // Space for line list

    const availableHeight = height - mapStartY - mapBottomMargin;
    const availableWidth = width - mapLeftMargin - 20;

    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    const mapScale = Math.min(1, scaleX, scaleY);

    this.mapContainer.scale.set(mapScale);
    this.mapContainer.x =
      mapLeftMargin + (availableWidth - mapWidth * mapScale) / 2;
    this.mapContainer.y = mapStartY;
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    // Fade in all elements
    const elementsToAnimate = [
      this.titleLabel,
      this.instructionLabel,
      this.moneyLabel,
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
      this.lineListContainer,
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
