import { CircularProgressBar } from "@pixi/ui";
import { animate } from "motion";
import type { ObjectTarget } from "motion/react";
import type { Ticker } from "pixi.js";
import { Container, Graphics } from "pixi.js";

/** Screen shown while loading assets */
export class LoadScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["preload"];
  /** Metro symbol loader */
  private metroSymbol: Container;
  private metroLines: Graphics;
  private trains: { graphic: Graphics; progress: number; speed: number }[] = [];
  private pathPoints = [
    { x: -36, y: 34 },
    { x: -36, y: -36 },
    { x: 0, y: 22 },
    { x: 36, y: -36 },
    { x: 36, y: 34 },
  ];
  private pathSegmentLengths: number[] = [];
  private pathLength = 0;
  /** Progress Bar */
  private progressBar: CircularProgressBar;

  constructor() {
    super();

    this.progressBar = new CircularProgressBar({
      backgroundColor: "#3d3d3d",
      fillColor: "#e72264",
      radius: 100,
      lineWidth: 15,
      value: 20,
      backgroundAlpha: 0.5,
      fillAlpha: 0.8,
      cap: "round",
    });

    this.progressBar.x += this.progressBar.width / 2;
    this.progressBar.y += -this.progressBar.height / 2;

    this.addChild(this.progressBar);

    this.metroSymbol = new Container();
    this.metroLines = new Graphics();
    this.metroSymbol.addChild(this.metroLines);
    this.addChild(this.metroSymbol);

    this.drawMetroSymbol();
    this.buildPath();
    this.createTrains();
  }

  public onLoad(progress: number) {
    this.progressBar.progress = progress;
  }

  public update(time: Ticker) {
    const deltaSeconds = time.deltaMS / 1000;
    this.updateTrainPositions(deltaSeconds);
  }

  /** Resize the screen, fired whenever window size changes  */
  public resize(width: number, height: number) {
    this.metroSymbol.position.set(width * 0.5, height * 0.5);
    this.progressBar.position.set(width * 0.5, height * 0.5);
  }

  /** Show screen with animations */
  public async show() {
    this.alpha = 1;
  }

  /** Hide screen with animations */
  public async hide() {
    await animate(this, { alpha: 0 } as ObjectTarget<this>, {
      duration: 0.3,
      ease: "linear",
      delay: 1,
    });
  }

  private drawMetroSymbol() {
    this.metroLines.clear();
    this.metroLines.circle(0, 0, 78);
    this.metroLines.stroke({ width: 10, color: 0xe72264, alpha: 0.9 });

    this.metroLines.setStrokeStyle({
      width: 8,
      color: 0xffffff,
      cap: "round",
      join: "round",
    });
    const [start, ...rest] = this.pathPoints;
    this.metroLines.moveTo(start.x, start.y);
    rest.forEach((point) => this.metroLines.lineTo(point.x, point.y));
    this.metroLines.stroke();
  }

  private buildPath() {
    this.pathSegmentLengths = [];
    this.pathLength = 0;
    for (let i = 0; i < this.pathPoints.length - 1; i++) {
      const start = this.pathPoints[i];
      const end = this.pathPoints[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      this.pathSegmentLengths.push(length);
      this.pathLength += length;
    }
  }

  private createTrains() {
    const trainCount = 3;
    for (let i = 0; i < trainCount; i++) {
      const train = new Graphics();
      train.roundRect(-8, -4, 16, 8, 3);
      train.fill({ color: 0xf5f5f5 });
      train.stroke({ width: 2, color: 0x1f1f1f });
      this.metroSymbol.addChild(train);
      this.trains.push({
        graphic: train,
        progress: i / trainCount,
        speed: 0.1,
      });
    }
    this.updateTrainPositions(0);
  }

  private updateTrainPositions(deltaSeconds: number) {
    if (this.pathLength === 0) return;
    for (const train of this.trains) {
      train.progress = (train.progress + train.speed * deltaSeconds) % 1;
      const position = this.getPositionAlongPath(train.progress);
      train.graphic.position.set(position.x, position.y);
      train.graphic.rotation = position.angle;
    }
  }

  private getPositionAlongPath(progress: number) {
    const targetDistance = progress * this.pathLength;
    let remaining = targetDistance;
    for (let i = 0; i < this.pathSegmentLengths.length; i++) {
      const segmentLength = this.pathSegmentLengths[i];
      const start = this.pathPoints[i];
      const end = this.pathPoints[i + 1];
      if (remaining <= segmentLength) {
        const t = segmentLength === 0 ? 0 : remaining / segmentLength;
        return {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
          angle: Math.atan2(end.y - start.y, end.x - start.x),
        };
      }
      remaining -= segmentLength;
    }

    const last = this.pathPoints[this.pathPoints.length - 1];
    const prev = this.pathPoints[this.pathPoints.length - 2];
    return {
      x: last.x,
      y: last.y,
      angle: Math.atan2(last.y - prev.y, last.x - prev.x),
    };
  }
}
