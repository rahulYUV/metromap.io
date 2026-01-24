/**
 * Map Picker Screen for MetroMap.io
 * Allows users to select a seed (0-999) and generate a map
 */

import { animate } from "motion";
import { Container, Graphics } from "pixi.js";

import { MapGenerator } from "../game/MapGenerator";
import { MapRenderer } from "../game/MapRenderer";
import type { MapGrid } from "../game/models/MapGrid";
import { Button } from "../ui/Button";
import { Label } from "../ui/Label";

const MIN_SEED = 0;
const MAX_SEED = 999;

export class MapPickerScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["main"];

  private titleLabel: Label;
  private seedLabel: Label;
  private seedValueLabel: Label;
  private mapTypeLabel: Label;

  private decrementButton: Button;
  private incrementButton: Button;
  private randomButton: Button;
  private generateButton: Button;

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
    this.decrementButton = new Button({
      text: "-",
      width: 80,
      height: 80,
      fontSize: 36,
    });
    this.decrementButton.onPress.connect(() => this.adjustSeed(-1));
    this.addChild(this.decrementButton);

    this.incrementButton = new Button({
      text: "+",
      width: 80,
      height: 80,
      fontSize: 36,
    });
    this.incrementButton.onPress.connect(() => this.adjustSeed(1));
    this.addChild(this.incrementButton);

    // Random seed button
    this.randomButton = new Button({
      text: "Random",
      width: 140,
      height: 60,
      fontSize: 20,
    });
    this.randomButton.onPress.connect(() => this.randomizeSeed());
    this.addChild(this.randomButton);

    // Generate button
    this.generateButton = new Button({
      text: "Generate Map",
      width: 200,
      height: 80,
      fontSize: 24,
    });
    this.generateButton.onPress.connect(() => this.generateMap());
    this.addChild(this.generateButton);

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
    this.titleLabel.y = 50;

    // Seed controls area
    const controlsY = 130;

    this.seedLabel.x = centerX - 120;
    this.seedLabel.y = controlsY;

    this.decrementButton.x = centerX - 60;
    this.decrementButton.y = controlsY;

    this.seedValueLabel.x = centerX;
    this.seedValueLabel.y = controlsY;

    this.incrementButton.x = centerX + 60;
    this.incrementButton.y = controlsY;

    this.randomButton.x = centerX + 150;
    this.randomButton.y = controlsY;

    // Map type label
    this.mapTypeLabel.x = centerX;
    this.mapTypeLabel.y = controlsY + 50;

    // Map display - centered
    const mapWidth = this.mapRenderer.getMapWidth();
    const mapHeight = this.mapRenderer.getMapHeight();

    // Scale map to fit if needed
    const availableHeight = height - 300;
    const availableWidth = width - 40;
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    const mapScale = Math.min(1, scaleX, scaleY);

    this.mapContainer.scale.set(mapScale);
    this.mapContainer.x = centerX - (mapWidth * mapScale) / 2;
    this.mapContainer.y = 200;

    // Generate button at bottom
    this.generateButton.x = centerX;
    this.generateButton.y = height - 60;
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
