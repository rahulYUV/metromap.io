/**
 * Map Picker Screen for MetroMap.io
 * Allows users to select a seed (0-999) and generate a map
 */

import { animate } from "motion";
import { Container, Graphics } from "pixi.js";

import { engine } from "../getEngine";
import { MapGenerator } from "../game/MapGenerator";
import { MapRenderer } from "../game/MapRenderer";
import type { MapGrid } from "../game/models/MapGrid";
import { FlatButton } from "../ui/FlatButton";
import { Label } from "../ui/Label";
import { MetroBuildingScreen } from "./MetroBuildingScreen";

const MIN_SEED = 0;
const MAX_SEED = 999;

export class MapPickerScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  private titleLabel: Label;
  private seedLabel: Label;
  private seedValueLabel: Label;
  private mapTypeLabel: Label;

  private decrementButton: FlatButton;
  private incrementButton: FlatButton;
  private randomButton: FlatButton;
  private generateButton: FlatButton;
  private showResidentialButton: FlatButton;
  private showOfficeButton: FlatButton;
  private showDefaultButton: FlatButton;
  private showBothButton: FlatButton;
  private startButton: FlatButton;

  private mapRenderer: MapRenderer;
  private mapContainer: Container;
  private mapBackground: Graphics;

  private currentSeed: number = 0;
  private currentMap: MapGrid | null = null;

  constructor() {
    super();

    // Title
    this.titleLabel = new Label({
      text: "MetroMap.io",
      style: {
        fontSize: 48,
        fill: 0xffffff,
      },
    });
    this.addChild(this.titleLabel);

    // Seed label
    this.seedLabel = new Label({
      text: "Seed:",
      style: {
        fontSize: 24,
        fill: 0xcccccc,
      },
    });
    this.addChild(this.seedLabel);

    // Seed value display
    this.seedValueLabel = new Label({
      text: this.formatSeed(this.currentSeed),
      style: {
        fontSize: 36,
        fill: 0xffffff,
        fontFamily: "monospace",
      },
    });
    this.addChild(this.seedValueLabel);

    // Map type label
    this.mapTypeLabel = new Label({
      text: "",
      style: {
        fontSize: 20,
        fill: 0x88ccff,
      },
    });
    this.addChild(this.mapTypeLabel);

    // Seed control buttons
    this.decrementButton = new FlatButton({
      text: "-",
      width: 50,
      height: 50,
      fontSize: 28,
      backgroundColor: 0x555555,
    });
    this.decrementButton.onPress.connect(() => this.adjustSeed(-1));
    this.addChild(this.decrementButton);

    this.incrementButton = new FlatButton({
      text: "+",
      width: 50,
      height: 50,
      fontSize: 28,
      backgroundColor: 0x555555,
    });
    this.incrementButton.onPress.connect(() => this.adjustSeed(1));
    this.addChild(this.incrementButton);

    // Random seed button
    this.randomButton = new FlatButton({
      text: "Random",
      width: 100,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x4a90e2,
    });
    this.randomButton.onPress.connect(() => this.randomizeSeed());
    this.addChild(this.randomButton);

    // Generate button
    this.generateButton = new FlatButton({
      text: "Generate",
      width: 120,
      height: 50,
      fontSize: 18,
      backgroundColor: 0x22aa66,
    });
    this.generateButton.onPress.connect(() => this.generateMap());
    this.addChild(this.generateButton);

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

    // START button to proceed to metro building
    this.startButton = new FlatButton({
      text: "START",
      width: 150,
      height: 60,
      fontSize: 24,
      backgroundColor: 0x22aa66,
    });
    this.startButton.onPress.connect(() => this.startMetroBuilding());
    this.addChild(this.startButton);

    // Map display container
    this.mapContainer = new Container();
    this.addChild(this.mapContainer);

    // Map background (border)
    this.mapBackground = new Graphics();
    this.mapContainer.addChild(this.mapBackground);

    // Map renderer
    this.mapRenderer = new MapRenderer();
    this.mapContainer.addChild(this.mapRenderer);

    // Generate initial map
    this.generateMap();
  }

  /**
   * Format seed as 3-digit string
   */
  private formatSeed(seed: number): string {
    return seed.toString().padStart(3, "0");
  }

  /**
   * Adjust seed by delta amount
   */
  private adjustSeed(delta: number): void {
    this.currentSeed += delta;
    if (this.currentSeed > MAX_SEED) this.currentSeed = MIN_SEED;
    if (this.currentSeed < MIN_SEED) this.currentSeed = MAX_SEED;
    this.seedValueLabel.text = this.formatSeed(this.currentSeed);
  }

  /**
   * Set seed to random value
   */
  private randomizeSeed(): void {
    this.currentSeed = Math.floor(Math.random() * (MAX_SEED + 1));
    this.seedValueLabel.text = this.formatSeed(this.currentSeed);
  }

  /**
   * Generate map based on current seed
   */
  private generateMap(): void {
    const generator = new MapGenerator(this.currentSeed);
    this.currentMap = generator.generate();
    this.mapRenderer.renderMap(this.currentMap);

    // Update map type label
    this.mapTypeLabel.text = `Type: ${this.currentMap.mapType}`;

    // Draw map background/border
    this.drawMapBackground();
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
   * Start metro building phase
   */
  private async startMetroBuilding(): Promise<void> {
    if (!this.currentMap) return;

    // Navigate to metro building screen
    const nav = engine().navigation;
    await nav.showScreen(MetroBuildingScreen);

    // Pass the map to the screen after it's created
    const screen = nav.currentScreen as MetroBuildingScreen;
    if (screen && screen.setMap) {
      screen.setMap(this.currentMap);
    }
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

    // --- Row 1: Seed Controls (Y=80) ---
    const row1Y = 80;
    const gap = 10;

    // Defined widths for calculation (based on initialization)
    const wLabel = 60; // Approx for "Seed:"
    const wDec = 50; // Button width
    const wVal = 80; // Approx for "000"
    const wInc = 50; // Button width
    const wRand = 120; // Random button (widened slightly for balance)
    const wGen = 120; // Generate button

    // Calculate total width to center the group
    // Group: [Seed:] [Dec] [Val] [Inc]  --Gap-- [Random] [Generate]
    const seedGroupWidth = wLabel + gap + wDec + gap + wVal + gap + wInc;
    const actionGroupWidth = wRand + gap + wGen;
    const groupGap = 30; // Gap between seed selector and action buttons

    const totalRow1Width = seedGroupWidth + groupGap + actionGroupWidth;
    let currentX = centerX - totalRow1Width / 2;

    // Seed Label
    this.seedLabel.x = currentX + wLabel / 2;
    this.seedLabel.y = row1Y;
    currentX += wLabel + gap;

    // Decrement
    this.decrementButton.x = currentX + wDec / 2;
    this.decrementButton.y = row1Y;
    currentX += wDec + gap;

    // Value
    this.seedValueLabel.x = currentX + wVal / 2;
    this.seedValueLabel.y = row1Y;
    currentX += wVal + gap;

    // Increment
    this.incrementButton.x = currentX + wInc / 2;
    this.incrementButton.y = row1Y;
    currentX += wInc + groupGap;

    // Random
    this.randomButton.width = wRand; // Update width to match layout
    this.randomButton.x = currentX + wRand / 2;
    this.randomButton.y = row1Y;
    currentX += wRand + gap;

    // Generate
    this.generateButton.x = currentX + wGen / 2;
    this.generateButton.y = row1Y;

    // --- Row 2: Type Info (Y=125) ---
    const rowInfoY = 125;
    this.mapTypeLabel.x = centerX;
    this.mapTypeLabel.y = rowInfoY;

    // --- Row 3: Visualization & Start (Y=165) ---
    const row2Y = 170;

    // Widths
    const wVizDef = 100;
    const wVizRes = 120;
    const wVizOff = 100;
    const wVizBoth = 100;
    const wStart = 160;
    const startGap = 40; // Gap before START button

    const totalRow2Width =
      wVizDef +
      gap +
      wVizRes +
      gap +
      wVizOff +
      gap +
      wVizBoth +
      startGap +
      wStart;
    currentX = centerX - totalRow2Width / 2;

    // Default
    this.showDefaultButton.x = currentX + wVizDef / 2;
    this.showDefaultButton.y = row2Y;
    currentX += wVizDef + gap;

    // Residential
    this.showResidentialButton.x = currentX + wVizRes / 2;
    this.showResidentialButton.y = row2Y;
    currentX += wVizRes + gap;

    // Office
    this.showOfficeButton.x = currentX + wVizOff / 2;
    this.showOfficeButton.y = row2Y;
    currentX += wVizOff + gap;

    // Both
    this.showBothButton.x = currentX + wVizBoth / 2;
    this.showBothButton.y = row2Y;
    currentX += wVizBoth + startGap;

    // START Button
    this.startButton.width = wStart; // Update width
    this.startButton.x = currentX + wStart / 2;
    this.startButton.y = row2Y;

    // --- Map Display ---
    const mapStartY = 210;
    const mapBottomMargin = 10;

    const availableHeight = height - mapStartY - mapBottomMargin;
    const availableWidth = width - 40;

    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();

    // Scale map to fit if needed
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
      this.seedLabel,
      this.seedValueLabel,
      this.decrementButton,
      this.incrementButton,
      this.randomButton,
      this.generateButton,
      this.mapContainer,
      this.mapTypeLabel,
      this.showDefaultButton,
      this.showResidentialButton,
      this.showOfficeButton,
      this.showBothButton,
      this.startButton,
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
   * Get the currently generated map
   */
  public getCurrentMap(): MapGrid | null {
    return this.currentMap;
  }

  /**
   * Get the current seed
   */
  public getSeed(): number {
    return this.currentSeed;
  }
}
