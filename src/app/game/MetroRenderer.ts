/**
 * Metro Renderer for MetroMap.io
 * Renders stations, metro lines, and trains.
 * Handles Harry Beck style line rendering and train visualization.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { MetroLine } from "./models/MetroLine";
import { LINE_COLOR_HEX } from "./models/MetroLine";
import type { Station } from "./models/Station";
import type { Train } from "./models/Train";
import {
  calculateSegmentPath,
  calculateSnapAngle,
  createSegmentKey,
  getSegmentOrientation,
  DIRECTION_VECTORS,
  Direction,
  type LineSegment,
  type Waypoint,
} from "./pathfinding/LinePath";
import { TILE_SIZE } from "./config";

// Visual constants
export { TILE_SIZE };
export const STATION_RADIUS = TILE_SIZE * 0.5;
export const STATION_COLOR = 0xffffff;
export const STATION_BORDER_COLOR = 0x000000;
export const STATION_BORDER_WIDTH = 2;
export const LINE_WIDTH = 4;
export const LINE_OFFSET = 4; // Offset for parallel lines
export const TRAIN_HEIGHT = 8;

/**
 * Information about lines sharing a segment
 */
interface SegmentSharingInfo {
  lineIndices: number[]; // Indices of lines that share this segment
  orientation: "HORIZONTAL" | "VERTICAL" | "DIAGONAL";
}

export class MetroRenderer extends Container {
  public linesLayer: Graphics;
  public trainsLayer: Graphics;
  public stationsLayer: Graphics;
  public labelsLayer: Container;
  public stationHitAreasLayer: Container;

  private stationPassengerCountCache = new Map<string, Text>();
  private stationNameLabelCache = new Map<string, Text>();
  private stationHitAreaCache = new Map<string, Graphics>();
  public onStationClick?: (station: Station) => void;

  constructor() {
    super();

    // Layers ordered by z-index
    this.linesLayer = new Graphics();
    this.addChild(this.linesLayer);

    this.trainsLayer = new Graphics();
    this.addChild(this.trainsLayer);

    this.stationsLayer = new Graphics();
    this.addChild(this.stationsLayer);

    this.labelsLayer = new Container();
    this.addChild(this.labelsLayer);

    // Interactive layer on top for station clicks
    this.stationHitAreasLayer = new Container();
    this.addChild(this.stationHitAreasLayer);
  }

  /**
   * Render all stations
   */
  public renderStations(stations: Station[]): void {
    this.stationsLayer.clear();

    for (const station of stations) {
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

    this.renderStationLabels(stations);
    this.renderStationNameLabels(stations);
    this.renderStationHitAreas(stations);
  }

  /**
   * Render station name labels (A, B, C, etc.)
   */
  public renderStationNameLabels(stations: Station[]): void {
    for (const station of stations) {
      let label = this.stationNameLabelCache.get(station.id);

      if (!label) {
        label = new Text({
          text: station.label,
          style: new TextStyle({
            fontFamily: "Arial",
            fontSize: 12,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3 },
            fontWeight: "bold",
          }),
        });
        label.anchor.set(0.5); // Center anchor
        this.labelsLayer.addChild(label);
        this.stationNameLabelCache.set(station.id, label);
      }

      label.text = station.label;
      label.x = station.vertexX * TILE_SIZE;
      label.y = station.vertexY * TILE_SIZE;
      label.visible = true;
    }
  }

  /**
   * Create interactive hit areas for stations
   */
  public renderStationHitAreas(stations: Station[]): void {
    // Clear old hit areas that are no longer needed
    const currentStationIds = new Set(stations.map((s) => s.id));
    for (const [id, hitArea] of this.stationHitAreaCache.entries()) {
      if (!currentStationIds.has(id)) {
        hitArea.destroy();
        this.stationHitAreaCache.delete(id);
      }
    }

    // Create or update hit areas
    for (const station of stations) {
      let hitArea = this.stationHitAreaCache.get(station.id);

      if (!hitArea) {
        hitArea = new Graphics();
        hitArea.eventMode = "static";
        hitArea.cursor = "pointer";
        hitArea.on("pointertap", () => {
          if (this.onStationClick) {
            this.onStationClick(station);
          }
        });
        this.stationHitAreasLayer.addChild(hitArea);
        this.stationHitAreaCache.set(station.id, hitArea);
      }

      // Draw larger clickable area
      const px = station.vertexX * TILE_SIZE;
      const py = station.vertexY * TILE_SIZE;
      const hitRadius = STATION_RADIUS * 2; // Larger hit area for easier clicking

      hitArea.clear();
      hitArea.circle(px, py, hitRadius);
      hitArea.fill({ color: 0x000000, alpha: 0 }); // Invisible
    }
  }

  /**
   * Update station passenger count labels
   */
  public renderStationLabels(stations: Station[]): void {
    for (const station of stations) {
      const count = station.passengers ? station.passengers.length : 0;
      let label = this.stationPassengerCountCache.get(station.id);

      if (count > 0) {
        if (!label) {
          label = new Text({
            text: count.toString(),
            style: new TextStyle({
              fontFamily: "Arial",
              fontSize: 10,
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 2 },
              fontWeight: "bold",
            }),
          });
          label.anchor.set(0.5, 1); // Bottom center anchor
          this.labelsLayer.addChild(label);
          this.stationPassengerCountCache.set(station.id, label);
        }

        label.text = count.toString();
        label.x = station.vertexX * TILE_SIZE;
        label.y = station.vertexY * TILE_SIZE - STATION_RADIUS - 2;
        label.visible = true;
      } else {
        if (label) {
          label.visible = false;
        }
      }
    }
  }

  /**
   * Render metro lines
   * @param lines - List of completed lines
   * @param stations - List of all stations (needed for positioning)
   * @param tempLine - Optional temporary line being built (rendered with transparency)
   */
  public renderLines(
    lines: MetroLine[],
    stations: Station[],
    tempLine?: MetroLine,
  ): void {
    this.linesLayer.clear();

    // Build the segment sharing map
    const segmentMap = this.buildSegmentSharingMap(lines, stations, tempLine);

    // Draw completed lines
    lines.forEach((line, lineIndex) => {
      this.drawLine(line, stations, lineIndex, segmentMap, false);
    });

    // Draw temp line if provided
    if (tempLine) {
      this.drawLine(tempLine, stations, lines.length, segmentMap, true);
    }
  }

  /**
   * Render trains
   */
  public renderTrains(lines: MetroLine[], stations: Station[]): void {
    this.trainsLayer.clear();

    // We need the sharing map to correctly position trains on offset lines
    const segmentMap = this.buildSegmentSharingMap(lines, stations);

    for (const line of lines) {
      if (!line.trains) continue;

      const lineColor = LINE_COLOR_HEX[line.color];
      const lineIndex = lines.indexOf(line);

      for (const train of line.trains) {
        if (!train.currentSegment) continue;

        // Calculate position based on progress
        const pos = this.getTrainPosition(train, lineIndex, segmentMap);
        if (!pos) continue;

        // Train dimensions
        const h = TRAIN_HEIGHT;
        const cos = Math.cos(pos.angle);
        const sin = Math.sin(pos.angle);

        // Shape definition (local coords, 0,0 is center)
        // Body: Rect part length = 13.5
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

        // Draw passenger density bars (3-bar indicator like battery)
        const passengerCount = train.passengers.length;

        // Determine number of bars to fill (0-3)
        let filledBars = 0;
        if (passengerCount > 0) {
          // 0-10 passengers: 1 bar, 11-20: 2 bars, 21-30: 3 bars
          filledBars = Math.min(3, Math.ceil(passengerCount / 10));
        }

        // Draw 3 bars inside the rectangular body
        // Bar dimensions (in local coords)
        const barSpacing = 0.8; // Space between bars
        const barWidth = 2.5; // Width of each bar
        const barHeight = h - 2; // Height with small margin

        // Position bars inside the body (avoiding the head)
        // Body extends from tailX (-8.25) to shoulderX (5.25)
        // We'll place 3 bars with equal spacing
        const bodyLength = shoulderX - tailX;
        const totalBarsWidth = 3 * barWidth + 2 * barSpacing;
        const barStartX = tailX + (bodyLength - totalBarsWidth) / 2;

        for (let i = 0; i < 3; i++) {
          const barX = barStartX + i * (barWidth + barSpacing);
          const barY = -barHeight / 2;

          // Create bar rectangle points (4 corners)
          const barPoints = [
            { x: barX, y: barY },
            { x: barX + barWidth, y: barY },
            { x: barX + barWidth, y: barY + barHeight },
            { x: barX, y: barY + barHeight },
          ];

          // Transform bar points
          const tBarPoints = barPoints.map((p) => ({
            x: pos.x + (p.x * cos - p.y * sin),
            y: pos.y + (p.x * sin + p.y * cos),
          }));

          this.trainsLayer.poly(tBarPoints.flatMap((p) => [p.x, p.y]));

          // Fill bar if within filled count
          if (i < filledBars) {
            this.trainsLayer.fill({ color: 0xffffff, alpha: 0.8 }); // White fill
          } else {
            this.trainsLayer.fill({ color: 0x000000, alpha: 0.3 }); // Dark empty
          }
        }
      }
    }
  }

  /**
   * Build a map of which segments are shared by which lines
   */
  private buildSegmentSharingMap(
    lines: MetroLine[],
    stations: Station[],
    tempLine?: MetroLine,
  ): Map<string, SegmentSharingInfo> {
    const segmentMap = new Map<string, SegmentSharingInfo>();

    const processLine = (line: MetroLine, lineIndex: number) => {
      for (let i = 0; i < line.stationIds.length - 1; i++) {
        const fromId = line.stationIds[i];
        const toId = line.stationIds[i + 1];
        const key = createSegmentKey(fromId, toId);

        if (!segmentMap.has(key)) {
          // Calculate orientation based on station positions
          const fromStation = stations.find((s) => s.id === fromId);
          const toStation = stations.find((s) => s.id === toId);

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
    };

    // Process all completed lines
    lines.forEach((line, index) => processLine(line, index));

    // Process temp line if provided
    if (tempLine && tempLine.stationIds.length > 1) {
      processLine(tempLine, lines.length);
    }

    return segmentMap;
  }

  /**
   * Draw a single metro line
   */
  private drawLine(
    line: MetroLine,
    stations: Station[],
    lineIndex: number,
    segmentMap: Map<string, SegmentSharingInfo>,
    isTemp: boolean,
  ): void {
    if (line.stationIds.length < 2) return;

    const color = LINE_COLOR_HEX[line.color];

    // Get station objects (filter out any missing ones)
    const lineStations = line.stationIds
      .map((id) => stations.find((s) => s.id === id))
      .filter((s): s is Station => s !== undefined);

    if (lineStations.length < 2) return;

    const segments: LineSegment[] = [];
    const segmentOffsets: { offsetX: number; offsetY: number }[] = [];

    for (let i = 0; i < lineStations.length - 1; i++) {
      const from = lineStations[i];
      const to = lineStations[i + 1];

      // Look ahead to the next segment to optimize angles at intermediate stations
      let nextAngle: Direction | null = null;
      if (i < lineStations.length - 2) {
        const nextStation = lineStations[i + 2];
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

        // Apply offset based on segment orientation
        const offsetAmount = (normalizedPosition * LINE_OFFSET) / TILE_SIZE;

        if (sharingInfo.orientation === "HORIZONTAL") {
          offsetY = offsetAmount;
        } else if (sharingInfo.orientation === "VERTICAL") {
          offsetX = offsetAmount;
        } else {
          // Diagonal
          const dx = to.vertexX - from.vertexX;
          const dy = to.vertexY - from.vertexY;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            offsetX = (-dy / length) * offsetAmount;
            offsetY = (dx / length) * offsetAmount;
          }
        }
      }

      segmentOffsets.push({ offsetX, offsetY });
    }

    this.renderSegmentsToCanvas(segments, segmentOffsets, color, isTemp);
  }

  /**
   * Render line segments to canvas with bezier curves at bends
   */
  private renderSegmentsToCanvas(
    segments: LineSegment[],
    segmentOffsets: { offsetX: number; offsetY: number }[],
    color: number,
    isTemp: boolean,
  ): void {
    if (segments.length === 0) return;

    const cornerRadius = LINE_WIDTH * 2;
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
      width: LINE_WIDTH,
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
   * Get exact pixel position and angle of a train
   */
  private getTrainPosition(
    train: Train,
    lineIndex: number,
    segmentMap: Map<string, SegmentSharingInfo>,
  ): { x: number; y: number; angle: number } | null {
    if (!train.currentSegment) return null;

    const waypoints = train.currentSegment.waypoints;

    // Calculate line offset
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

    // Traverse waypoints
    const totalDist = train.totalLength * train.progress;
    let currentDist = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      const p1x = p1.x + offsetX;
      const p1y = p1.y + offsetY;
      const p2x = p2.x + offsetX;
      const p2y = p2.y + offsetY;

      const dist = Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2));

      if (currentDist + dist >= totalDist) {
        const segmentProgress = (totalDist - currentDist) / dist;
        const x = p1x + (p2x - p1x) * segmentProgress;
        const y = p1y + (p2y - p1y) * segmentProgress;
        const angle = Math.atan2(p2y - p1y, p2x - p1x);

        return { x: x * TILE_SIZE, y: y * TILE_SIZE, angle };
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
}
