/**
 * Seeded Map Generator for MetroMap.io
 * Generates either River or Archipelago maps based on seed value
 */

import {
  randomSeeded,
  randomBool,
  randomInt,
  randomFloat,
} from "../../engine/utils/random";
import {
  type GridSquare,
  type MapGrid,
  type MapType,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "./models/MapGrid";

type Edge = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
type RiverType = "SINGLE" | "BRANCHING" | "TWO_SEPARATE";

export class MapGenerator {
  private random: () => number;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    // Create seeded random function
    this.random = randomSeeded(seed.toString());
  }

  /**
   * Generate a complete map based on the seed
   */
  public generate(): MapGrid {
    // 50:50 chance of river or archipelago, determined by seed
    const mapType: MapType = randomBool(0.5, this.random)
      ? "RIVER"
      : "ARCHIPELAGO";

    // Initialize all squares as land
    const squares = this.initializeGrid();

    if (mapType === "RIVER") {
      this.generateRiverMap(squares);
    } else {
      this.generateArchipelagoMap(squares);
    }

    return {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      seed: this.seed,
      mapType,
      squares,
    };
  }

  /**
   * Initialize grid with all land tiles
   */
  private initializeGrid(): GridSquare[][] {
    const squares: GridSquare[][] = [];

    for (let y = 0; y < MAP_HEIGHT; y++) {
      squares[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        squares[y][x] = {
          x,
          y,
          type: "LAND",
          homeDensity: 0,
          officeDensity: 0,
        };
      }
    }

    return squares;
  }

  /**
   * Generate a river-based map
   * - 50% single river
   * - 25% branching (2 rivers merge into 1)
   * - 25% two separate rivers
   */
  private generateRiverMap(squares: GridSquare[][]): void {
    const roll = this.random();
    let riverType: RiverType;

    if (roll < 0.5) {
      riverType = "SINGLE";
    } else if (roll < 0.75) {
      riverType = "BRANCHING";
    } else {
      riverType = "TWO_SEPARATE";
    }

    // Pick axis: horizontal (LEFT-RIGHT) or vertical (TOP-BOTTOM)
    const isHorizontal = randomBool(0.5, this.random);
    const startEdge: Edge = isHorizontal ? "LEFT" : "TOP";
    const endEdge: Edge = isHorizontal ? "RIGHT" : "BOTTOM";

    switch (riverType) {
      case "SINGLE":
        this.generateSingleRiver(squares, startEdge, endEdge);
        break;
      case "BRANCHING":
        this.generateBranchingRiver(squares, startEdge, endEdge);
        break;
      case "TWO_SEPARATE":
        this.generateTwoSeparateRivers(squares, startEdge, endEdge);
        break;
    }
  }

  /**
   * Generate a single river from one edge to the opposite
   */
  private generateSingleRiver(
    squares: GridSquare[][],
    startEdge: Edge,
    endEdge: Edge,
  ): void {
    const startPos = this.getRandomEdgePosition(startEdge, 0.3, 0.7);
    const endPos = this.getRandomEdgePosition(endEdge, 0.3, 0.7);
    const width = randomInt(1, 4, this.random);

    this.drawRiverPath(squares, startPos, endPos, width);
  }

  /**
   * Generate a branching river (2 rivers merge into 1)
   * Starts as 2 rivers on one side, merges to 1 on the other side
   */
  private generateBranchingRiver(
    squares: GridSquare[][],
    startEdge: Edge,
    endEdge: Edge,
  ): void {
    // Two starting points
    const startPos1 = this.getRandomEdgePosition(startEdge, 0.15, 0.4);
    const startPos2 = this.getRandomEdgePosition(startEdge, 0.6, 0.85);

    // Single end point
    const endPos = this.getRandomEdgePosition(endEdge, 0.35, 0.65);

    // Merge point somewhere in the middle
    const isHorizontal = startEdge === "LEFT" || startEdge === "RIGHT";
    const mergePoint = {
      x: isHorizontal
        ? Math.floor(MAP_WIDTH * randomFloat(0.4, 0.6, this.random))
        : Math.floor(
            (startPos1.x + startPos2.x) / 2 + randomInt(-3, 3, this.random),
          ),
      y: isHorizontal
        ? Math.floor(
            (startPos1.y + startPos2.y) / 2 + randomInt(-3, 3, this.random),
          )
        : Math.floor(MAP_HEIGHT * randomFloat(0.4, 0.6, this.random)),
    };

    // Clamp merge point
    mergePoint.x = Math.max(2, Math.min(MAP_WIDTH - 3, mergePoint.x));
    mergePoint.y = Math.max(2, Math.min(MAP_HEIGHT - 3, mergePoint.y));

    const width1 = randomInt(1, 4, this.random);
    const width2 = randomInt(1, 4, this.random);
    const width3 = Math.min(4, width1 + width2);

    // Draw first branch to merge point
    this.drawRiverPath(squares, startPos1, mergePoint, width1);
    // Draw second branch to merge point
    this.drawRiverPath(squares, startPos2, mergePoint, width2);
    // Draw from merge point to end
    this.drawRiverPath(squares, mergePoint, endPos, width3);
  }

  /**
   * Generate two separate rivers
   */
  private generateTwoSeparateRivers(
    squares: GridSquare[][],
    startEdge: Edge,
    endEdge: Edge,
  ): void {
    // First river in upper/left portion
    const startPos1 = this.getRandomEdgePosition(startEdge, 0.1, 0.35);
    const endPos1 = this.getRandomEdgePosition(endEdge, 0.1, 0.35);

    // Second river in lower/right portion
    const startPos2 = this.getRandomEdgePosition(startEdge, 0.65, 0.9);
    const endPos2 = this.getRandomEdgePosition(endEdge, 0.65, 0.9);

    const width1 = randomInt(1, 4, this.random);
    const width2 = randomInt(1, 4, this.random);

    this.drawRiverPath(squares, startPos1, endPos1, width1);
    this.drawRiverPath(squares, startPos2, endPos2, width2);
  }

  /**
   * Draw a river path from start to end
   * - Width 1: straight line (no bending)
   * - Width 2+: can meander
   */
  private drawRiverPath(
    squares: GridSquare[][],
    start: { x: number; y: number },
    end: { x: number; y: number },
    width: number,
  ): void {
    if (width === 1) {
      // 1-square rivers must be straight
      this.drawStraightRiver(squares, start, end);
    } else {
      // 2+ square rivers can meander
      this.drawMeanderingRiver(squares, start, end, width);
    }
  }

  /**
   * Draw a perfectly straight 1-square wide river
   */
  private drawStraightRiver(
    squares: GridSquare[][],
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(start.x + dx * t);
      const y = Math.round(start.y + dy * t);

      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        squares[y][x].type = "WATER";
      }
    }
  }

  /**
   * Draw a meandering river with width 2+
   * Creates a centerline path then expands it
   */
  private drawMeanderingRiver(
    squares: GridSquare[][],
    start: { x: number; y: number },
    end: { x: number; y: number },
    width: number,
  ): void {
    // First, create a centerline path
    const centerline: { x: number; y: number }[] = [];
    let { x, y } = start;
    const maxSteps = MAP_WIDTH + MAP_HEIGHT + 100;
    let steps = 0;

    // Calculate main direction
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    while (steps < maxSteps) {
      centerline.push({ x: Math.round(x), y: Math.round(y) });

      // Check if we reached the end
      const distToEnd = Math.sqrt(
        Math.pow(x - end.x, 2) + Math.pow(y - end.y, 2),
      );
      if (distToEnd < 1.5) {
        centerline.push({ x: end.x, y: end.y });
        break;
      }

      // Calculate progress (0 to 1)
      const distFromStart = Math.sqrt(
        Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2),
      );
      const progress = Math.min(1, distFromStart / totalDist);

      // Direction towards end
      const dirX = end.x - x;
      const dirY = end.y - y;
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
      const normDirX = dirX / dirLen;
      const normDirY = dirY / dirLen;

      // Add meandering - more in the middle, less at edges
      const meanderStrength = Math.sin(progress * Math.PI) * 0.4;
      const meander = (this.random() - 0.5) * 2 * meanderStrength;

      // Perpendicular vector for meandering
      const perpX = -normDirY;
      const perpY = normDirX;

      // Calculate move
      let moveX = normDirX + perpX * meander;
      let moveY = normDirY + perpY * meander;

      // Normalize and scale
      const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX = moveX / moveLen;
      moveY = moveY / moveLen;

      // Move
      x = x + moveX;
      y = y + moveY;

      // Clamp to map bounds
      x = Math.max(0, Math.min(MAP_WIDTH - 1, x));
      y = Math.max(0, Math.min(MAP_HEIGHT - 1, y));

      steps++;
    }

    // Now expand the centerline to the desired width using edge-adjacent flood fill
    this.expandCenterlineToWidth(squares, centerline, width);
  }

  /**
   * Expand a centerline path to a given width ensuring edge-adjacency
   */
  private expandCenterlineToWidth(
    squares: GridSquare[][],
    centerline: { x: number; y: number }[],
    width: number,
  ): void {
    // Mark all centerline squares as water
    const waterSet = new Set<string>();
    for (const point of centerline) {
      const key = `${point.x},${point.y}`;
      waterSet.add(key);
      if (
        point.x >= 0 &&
        point.x < MAP_WIDTH &&
        point.y >= 0 &&
        point.y < MAP_HEIGHT
      ) {
        squares[point.y][point.x].type = "WATER";
      }
    }

    // Expand to reach target width using BFS (ensures edge-adjacency)
    const targetSquares = Math.floor(centerline.length * width * 0.8);
    const queue: { x: number; y: number }[] = [...centerline];

    while (waterSet.size < targetSquares && queue.length > 0) {
      const current = queue.shift()!;

      // Try to expand to adjacent squares (4-connected only)
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      // Shuffle neighbors for variety
      for (let i = neighbors.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
      }

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (
          neighbor.x >= 0 &&
          neighbor.x < MAP_WIDTH &&
          neighbor.y >= 0 &&
          neighbor.y < MAP_HEIGHT &&
          !waterSet.has(key)
        ) {
          // Only expand with some probability to create organic shapes
          if (this.random() < 0.6) {
            waterSet.add(key);
            squares[neighbor.y][neighbor.x].type = "WATER";
            queue.push(neighbor);

            if (waterSet.size >= targetSquares) {
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Get random position on an edge within a range (0-1 normalized)
   */
  private getRandomEdgePosition(
    edge: Edge,
    minRatio: number,
    maxRatio: number,
  ): { x: number; y: number } {
    switch (edge) {
      case "TOP":
        return {
          x: randomInt(
            Math.floor(MAP_WIDTH * minRatio),
            Math.floor(MAP_WIDTH * maxRatio),
            this.random,
          ),
          y: 0,
        };
      case "BOTTOM":
        return {
          x: randomInt(
            Math.floor(MAP_WIDTH * minRatio),
            Math.floor(MAP_WIDTH * maxRatio),
            this.random,
          ),
          y: MAP_HEIGHT - 1,
        };
      case "LEFT":
        return {
          x: 0,
          y: randomInt(
            Math.floor(MAP_HEIGHT * minRatio),
            Math.floor(MAP_HEIGHT * maxRatio),
            this.random,
          ),
        };
      case "RIGHT":
        return {
          x: MAP_WIDTH - 1,
          y: randomInt(
            Math.floor(MAP_HEIGHT * minRatio),
            Math.floor(MAP_HEIGHT * maxRatio),
            this.random,
          ),
        };
    }
  }

  /**
   * Generate an archipelago map with 4-6 islands
   * Water should be 20-40% of total area
   */
  private generateArchipelagoMap(squares: GridSquare[][]): void {
    // Start with all water
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        squares[y][x].type = "WATER";
      }
    }

    // Generate 4-6 island centers
    const islandCount = randomInt(4, 6, this.random);
    const islandCenters: { x: number; y: number; size: number }[] = [];

    // Distribute islands more evenly across the map
    const gridCols = islandCount <= 4 ? 2 : 3;
    const gridRows = 2;
    const cellWidth = MAP_WIDTH / gridCols;
    const cellHeight = MAP_HEIGHT / gridRows;

    for (let i = 0; i < islandCount; i++) {
      const gridX = i % gridCols;
      const gridY = Math.floor(i / gridCols);

      // Random position within grid cell with padding
      const padding = 4;
      const centerX =
        gridX * cellWidth +
        randomInt(padding, Math.floor(cellWidth) - padding, this.random);
      const centerY =
        gridY * cellHeight +
        randomInt(padding, Math.floor(cellHeight) - padding, this.random);

      islandCenters.push({
        x: Math.min(MAP_WIDTH - 3, Math.max(3, centerX)),
        y: Math.min(MAP_HEIGHT - 3, Math.max(3, centerY)),
        size: randomInt(5, 10, this.random), // Base radius for larger islands
      });
    }

    // Grow islands from centers using distance-based probability
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        let maxProb = 0;

        for (const center of islandCenters) {
          const dist = Math.sqrt(
            Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2),
          );
          // Probability decreases with distance
          const prob = Math.max(0, 1 - dist / (center.size + 1));
          maxProb = Math.max(maxProb, prob);
        }

        // Add some noise for organic shapes
        const noise = (this.random() - 0.5) * 0.4;
        const finalProb = Math.max(0, Math.min(1, maxProb + noise));

        if (finalProb > 0.3) {
          squares[y][x].type = "LAND";
        }
      }
    }

    // Ensure minimum island size of 4 squares
    this.removeSmallIslands(squares, 4);

    // Ensure water is between 20-40% (land 60-80%)
    this.adjustLandWaterRatio(squares, 0.6, 0.8);

    // Remove any water pockets (lakes) inside islands
    this.removeLakes(squares);
  }

  /**
   * Remove islands smaller than minimum size using flood fill
   */
  private removeSmallIslands(squares: GridSquare[][], minSize: number): void {
    const visited: boolean[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      visited[y] = new Array(MAP_WIDTH).fill(false);
    }

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (squares[y][x].type === "LAND" && !visited[y][x]) {
          const island = this.floodFill(squares, visited, x, y);

          if (island.length < minSize) {
            for (const tile of island) {
              squares[tile.y][tile.x].type = "WATER";
            }
          }
        }
      }
    }
  }

  /**
   * Flood fill to find connected land tiles
   */
  private floodFill(
    squares: GridSquare[][],
    visited: boolean[][],
    startX: number,
    startY: number,
  ): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;

      if (
        x < 0 ||
        x >= MAP_WIDTH ||
        y < 0 ||
        y >= MAP_HEIGHT ||
        visited[y][x] ||
        squares[y][x].type !== "LAND"
      ) {
        continue;
      }

      visited[y][x] = true;
      result.push({ x, y });

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    return result;
  }

  /**
   * Adjust land/water ratio to be within target range
   */
  private adjustLandWaterRatio(
    squares: GridSquare[][],
    minLandRatio: number,
    maxLandRatio: number,
  ): void {
    const totalSquares = MAP_WIDTH * MAP_HEIGHT;
    let landCount = this.countLand(squares);
    let iterations = 0;
    const maxIterations = 200;

    // If too little land, expand islands
    while (
      landCount / totalSquares < minLandRatio &&
      iterations < maxIterations
    ) {
      iterations++;
      const candidates: { x: number; y: number }[] = [];

      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (
            squares[y][x].type === "WATER" &&
            this.hasAdjacentLand(squares, x, y)
          ) {
            candidates.push({ x, y });
          }
        }
      }

      if (candidates.length === 0) break;

      const toConvert = Math.min(
        candidates.length,
        Math.ceil((minLandRatio * totalSquares - landCount) / 2),
      );

      for (let i = 0; i < toConvert && candidates.length > 0; i++) {
        const idx = randomInt(0, candidates.length - 1, this.random);
        const { x, y } = candidates[idx];
        squares[y][x].type = "LAND";
        candidates.splice(idx, 1);
        landCount++;
      }
    }

    // If too much land, erode edges
    iterations = 0;
    while (
      landCount / totalSquares > maxLandRatio &&
      iterations < maxIterations
    ) {
      iterations++;
      const candidates: { x: number; y: number }[] = [];

      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (
            squares[y][x].type === "LAND" &&
            this.hasAdjacentWater(squares, x, y)
          ) {
            candidates.push({ x, y });
          }
        }
      }

      if (candidates.length === 0) break;

      const toConvert = Math.min(
        candidates.length,
        Math.ceil((landCount - maxLandRatio * totalSquares) / 2),
      );

      for (let i = 0; i < toConvert && candidates.length > 0; i++) {
        const idx = randomInt(0, candidates.length - 1, this.random);
        const { x, y } = candidates[idx];
        squares[y][x].type = "WATER";
        candidates.splice(idx, 1);
        landCount--;
      }
    }

    // Final cleanup - remove any islands that became too small
    this.removeSmallIslands(squares, 4);
  }

  /**
   * Count land tiles
   */
  private countLand(squares: GridSquare[][]): number {
    let count = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (squares[y][x].type === "LAND") count++;
      }
    }
    return count;
  }

  /**
   * Check if tile has adjacent land
   */
  private hasAdjacentLand(
    squares: GridSquare[][],
    x: number,
    y: number,
  ): boolean {
    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 &&
        nx < MAP_WIDTH &&
        ny >= 0 &&
        ny < MAP_HEIGHT &&
        squares[ny][nx].type === "LAND"
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if tile has adjacent water
   */
  private hasAdjacentWater(
    squares: GridSquare[][],
    x: number,
    y: number,
  ): boolean {
    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 &&
        nx < MAP_WIDTH &&
        ny >= 0 &&
        ny < MAP_HEIGHT &&
        squares[ny][nx].type === "WATER"
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Remove water pockets (lakes) inside islands
   * Only water connected to map edges should remain
   */
  private removeLakes(squares: GridSquare[][]): void {
    // Mark all water tiles connected to edges as "ocean"
    const isOcean: boolean[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      isOcean[y] = new Array(MAP_WIDTH).fill(false);
    }

    // Flood fill from all edge water tiles
    const edgeWaterTiles: { x: number; y: number }[] = [];

    // Top and bottom edges
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (squares[0][x].type === "WATER") {
        edgeWaterTiles.push({ x, y: 0 });
      }
      if (squares[MAP_HEIGHT - 1][x].type === "WATER") {
        edgeWaterTiles.push({ x, y: MAP_HEIGHT - 1 });
      }
    }

    // Left and right edges
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if (squares[y][0].type === "WATER") {
        edgeWaterTiles.push({ x: 0, y });
      }
      if (squares[y][MAP_WIDTH - 1].type === "WATER") {
        edgeWaterTiles.push({ x: MAP_WIDTH - 1, y });
      }
    }

    // Flood fill from each edge water tile
    for (const tile of edgeWaterTiles) {
      this.markOceanWater(squares, isOcean, tile.x, tile.y);
    }

    // Convert all non-ocean water to land (these are lakes)
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (squares[y][x].type === "WATER" && !isOcean[y][x]) {
          squares[y][x].type = "LAND";
        }
      }
    }
  }

  /**
   * Flood fill to mark all water connected to edges as ocean
   */
  private markOceanWater(
    squares: GridSquare[][],
    isOcean: boolean[][],
    startX: number,
    startY: number,
  ): void {
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;

      if (
        x < 0 ||
        x >= MAP_WIDTH ||
        y < 0 ||
        y >= MAP_HEIGHT ||
        isOcean[y][x] ||
        squares[y][x].type !== "WATER"
      ) {
        continue;
      }

      isOcean[y][x] = true;

      // Check 4-connected neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }
}
