# Mini Metro Web Game - Technical Specifications

## 1. Core Game Architecture

### 1.1 Game State Management
```typescript
interface GameState {
  phase: 'MAP_GENERATION' | 'STATION_PLACEMENT' | 'RUNNING' | 'PAUSED';
  seed: number;
  map: MapGrid;
  stations: Station[];
  lines: MetroLine[];
  passengers: Passenger[];
  score: number;
  gameTime: number; // in-game minutes since start
  infraCost: number;
}
```

### 1.2 Data Structures

#### Map Grid
```typescript
interface MapGrid {
  width: 48;
  height: 32;
  squares: GridSquare[][];
}

interface GridSquare {
  x: number;
  y: number;
  type: 'LAND' | 'WATER';
  homeDensity: number; // 0-100
  officeDensity: number; // 0-100
}
```

#### Station System
```typescript
interface Station {
  id: string;
  x: number; // grid intersection coordinate (0-48)
  y: number; // grid intersection coordinate (0-32)
  connectedLines: string[]; // line IDs
  waitingPassengers: Passenger[];
  capacity: number; // max waiting passengers
}
```

#### Metro Lines
```typescript
interface MetroLine {
  id: string;
  color: string; // hex color
  stations: string[]; // ordered array of station IDs
  segments: LineSegment[];
  trainCount: number;
  trains: Train[];
}

interface LineSegment {
  start: {x: number, y: number};
  end: {x: number, y: number};
  type: 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL_NE' | 'DIAGONAL_SE';
  points: Point[]; // bezier curve points for smooth corners
}

interface Train {
  lineId: string;
  currentSegment: number;
  progress: number; // 0-1 along current segment
  passengers: Passenger[];
  capacity: number;
  direction: 1 | -1; // forward or backward along line
}
```

#### Passenger System
```typescript
interface Passenger {
  id: string;
  spawnStation: string;
  destinationStation: string;
  spawnTime: number;
  currentLocation: 'WAITING' | 'ON_TRAIN' | 'COMPLETED';
  patience: number; // despawns if waiting too long
  shape: 'CIRCLE' | 'SQUARE' | 'TRIANGLE'; // destination marker
}
```

## 2. Map Generation Algorithm

### 2.1 Seed-Based Random Number Generator
```typescript
class SeededRandom {
  constructor(seed: number);
  next(): number; // returns 0-1
  nextInt(min: number, max: number): number;
  nextGaussian(): number; // for density distributions
}
```

### 2.2 Water Generation
```typescript
interface WaterGenerationParams {
  seed: number;
  mapType: 'RIVER' | 'ARCHIPELAGO'; // determined by seed
}

// River Generation
function generateRiver(seed: number): void {
  // 1. Choose entry edge (top/left/right/bottom)
  // 2. Choose exit edge (opposite or adjacent)
  // 3. Width: 1-2 squares
  // 4. Generate path using Perlin noise for natural curves
  // 5. Ensure path stays within bounds
  // 6. Validate >50% land remains
}

// Archipelago Generation
function generateArchipelago(seed: number): void {
  // 1. Generate 3-7 island clusters using Voronoi/noise
  // 2. Each island has irregular shape
  // 3. Ensure >50% total land
  // 4. Islands should be separated but potentially connectable
}
```

### 2.3 Density Assignment
```typescript
function assignDensities(map: MapGrid, seed: number): void {
  // 1. Generate 2-4 residential hotspots (high home density)
  // 2. Generate 1-3 commercial centers (high office density)
  // 3. Use gradient falloff from centers
  // 4. Add noise for variety
  // 5. Most squares: high in one, low in other (inverse correlation)
  // 6. Some squares: both low (parks/suburbs)
  // 7. Some squares: both high (mixed-use downtown)
}

// Density distribution patterns:
// - CBD: office 70-100, home 20-50
// - Residential: home 70-100, office 10-30
// - Suburban: home 30-60, office 10-25
// - Industrial: office 60-90, home 5-20
// - Mixed-use: both 60-85
```

## 3. Station & Line Placement System

### 3.1 Station Placement
```typescript
interface StationPlacementRules {
  // Stations snap to grid intersections
  minX: 0;
  maxX: 48;
  minY: 0;
  maxY: 32;
  
  // Cost calculation
  baseCost: 100;
  waterCrossingMultiplier: 2.0; // if adjacent squares have water
}
```

### 3.2 Line Drawing System
```typescript
interface LineDrawingEngine {
  allowedDirections: [
    'HORIZONTAL',
    'VERTICAL', 
    'DIAGONAL_45_NE',
    'DIAGONAL_45_SE'
  ];
  
  // Harry Beck style rendering
  cornerRadius: number; // for smooth curves
  lineWidth: number;
  
  // Cost calculation
  costPerSegment: 50;
  waterCrossingCost: 200; // bridges/tunnels
}

// Path rendering algorithm
function renderLineSegment(start: Point, end: Point): SVGPath {
  // 1. Calculate direction
  // 2. If corner needed, create bezier curve
  // 3. Snap to 0°, 45°, 90° angles only
  // 4. Return smooth SVG path
}
```

### 3.3 Infrastructure Cost System
```typescript
function calculateInfraCost(state: GameState): number {
  let cost = 0;
  
  // Station costs
  cost += state.stations.length * STATION_BASE_COST;
  
  // Line segment costs
  state.lines.forEach(line => {
    line.segments.forEach(segment => {
      cost += SEGMENT_BASE_COST;
      if (crossesWater(segment)) {
        cost += WATER_CROSSING_COST;
      }
    });
  });
  
  // Train costs (optional: more trains = higher cost)
  state.lines.forEach(line => {
    cost += line.trainCount * TRAIN_COST;
  });
  
  return cost;
}
```

## 4. Simulation Engine

### 4.1 Time System
```typescript
interface TimeSystem {
  realTimePerGameMinute: 100; // ms
  minutesPerHour: 60;
  hoursPerDay: 24;
  
  getCurrentTimeOfDay(): 'MORNING_RUSH' | 'MIDDAY' | 'EVENING_RUSH' | 'NIGHT';
}

// Time periods
const TIME_PERIODS = {
  MORNING_RUSH: {hours: [7, 8, 9], direction: 'HOME_TO_OFFICE'},
  MIDDAY: {hours: [10, 11, 12, 13, 14, 15, 16], direction: 'MIXED'},
  EVENING_RUSH: {hours: [17, 18, 19], direction: 'OFFICE_TO_HOME'},
  NIGHT: {hours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6], direction: 'MINIMAL'}
};
```

### 4.2 Passenger Spawning System
```typescript
interface PassengerSpawner {
  spawnRate: number; // passengers per game-minute
  
  calculateSpawnProbability(square: GridSquare, timeOfDay: string): number {
    // Morning rush: home density × multiplier
    // Evening rush: office density × multiplier
    // Other times: lower base rate
  }
  
  selectDestination(origin: GridSquare, timeOfDay: string): GridSquare {
    // Morning: weighted towards high office density
    // Evening: weighted towards high home density
    // Distance factor: prefer medium-distance journeys
  }
}

function spawnPassengers(gameTime: number): void {
  const period = getCurrentTimeOfDay(gameTime);
  const spawnCount = calculateSpawnCount(period);
  
  for (let i = 0; i < spawnCount; i++) {
    // 1. Select spawn square weighted by relevant density
    // 2. Find nearest station to spawn square
    // 3. Select destination square based on time period
    // 4. Find nearest station to destination
    // 5. Create passenger with patience timer
    // 6. Assign shape marker (random: circle/square/triangle)
  }
}
```

### 4.3 Pathfinding System
```typescript
interface PathfindingEngine {
  findRoute(from: Station, to: Station, lines: MetroLine[]): Route | null;
}

interface Route {
  segments: RouteSegment[];
  totalStops: number;
  transferCount: number;
}

interface RouteSegment {
  line: MetroLine;
  boardStation: Station;
  alightStation: Station;
}

// A* pathfinding on station graph
function findShortestRoute(start: string, end: string): Route {
  // Graph: stations as nodes, line connections as edges
  // Heuristic: straight-line distance + transfer penalty
  // Return null if no route exists
}
```

### 4.4 Train Movement System
```typescript
class TrainSimulation {
  speed: number; // grid units per second
  stopDuration: number; // seconds at each station
  
  updateTrains(deltaTime: number): void {
    for (const train of allTrains) {
      if (train.atStation) {
        this.handleStationStop(train);
      } else {
        this.moveTrain(train, deltaTime);
      }
    }
  }
  
  handleStationStop(train: Train): void {
    // 1. Alight passengers at destination
    // 2. Board waiting passengers (up to capacity)
    // 3. Passengers board if route includes this line
    // 4. Wait for stopDuration
    // 5. Depart to next station
  }
  
  moveTrain(train: Train, deltaTime: number): void {
    // Update position along line segment
    // Smooth interpolation between stations
    // Handle direction reversal at line ends
  }
}
```

### 4.5 Scoring System
```typescript
interface ScoringSystem {
  journeysCompleted: number;
  infraCost: number;
  
  // Efficiency metric
  efficiency: number; // journeysCompleted / infraCost
  
  onPassengerCompleteJourney(passenger: Passenger): void {
    this.journeysCompleted++;
    // Bonus points for fast completion?
  }
  
  onPassengerTimeout(passenger: Passenger): void {
    // Penalty or just no points?
  }
}
```

## 5. Rendering System

### 5.1 Canvas/SVG Layers
```typescript
interface RenderLayers {
  mapLayer: 'BOTTOM'; // water and land
  densityHeatmapLayer: 'OVERLAY'; // toggleable
  lineLayer: 'MIDDLE'; // metro lines
  stationLayer: 'TOP'; // station dots
  trainLayer: 'TOP'; // moving trains
  passengerLayer: 'TOP'; // passenger icons
  uiLayer: 'OVERLAY'; // controls, score
}
```

### 5.2 Visual Specifications
```typescript
const VISUAL_SPECS = {
  gridSquare: {
    size: 16, // pixels
  },
  
  water: {
    color: '#4A90E2',
    shading: 'slight wave pattern',
  },
  
  land: {
    baseColor: '#E8E8E8',
    gridLines: '#D0D0D0',
  },
  
  heatmap: {
    homeGradient: ['#FFFFFF', '#FF6B6B'], // white to red
    officeGradient: ['#FFFFFF', '#4ECDC4'], // white to teal
    opacity: 0.6,
  },
  
  station: {
    shape: 'circle',
    radius: 6,
    color: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 2,
  },
  
  metroLine: {
    width: 4,
    colors: [
      '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
      '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'
    ],
  },
  
  train: {
    shape: 'rounded rectangle',
    size: 8,
    color: 'matches line color',
  },
  
  passenger: {
    size: 4,
    shapes: {
      circle: 'destination = residential',
      square: 'destination = office',
      triangle: 'destination = mixed'
    },
  },
};
```

### 5.3 UI Components
```typescript
interface UIComponents {
  // Phase 1: Map Generation
  seedInput: 'text field + generate button';
  visualizerToggle: 'checkbox for density heatmap';
  proceedButton: 'move to station placement';
  
  // Phase 2: Station/Line Placement
  stationPlacementMode: 'click to place';
  lineDrawingMode: 'click stations to connect';
  colorPicker: 'select line color';
  costDisplay: 'real-time infra cost';
  startGameButton: 'begin simulation';
  
  // Phase 3: Running Game
  pauseButton: 'pause/resume simulation';
  scoreDisplay: 'journeys completed';
  costDisplay: 'infra cost';
  efficiencyDisplay: 'score / cost ratio';
  timeOfDayIndicator: 'visual clock';
  
  // When paused
  addStationButton: 'return to placement mode';
  addLineButton: 'draw more lines';
  resumeButton: 'continue simulation';
}
```

## 6. Game Balance Parameters

### 6.1 Tunable Constants
```typescript
const GAME_BALANCE = {
  // Spawning
  BASE_SPAWN_RATE: 0.5, // passengers per game-minute
  RUSH_HOUR_MULTIPLIER: 3.0,
  MIDDAY_MULTIPLIER: 1.0,
  NIGHT_MULTIPLIER: 0.1,
  
  // Passenger behavior
  PATIENCE_TIME: 300, // game-seconds before despawn
  MAX_TRANSFER_COUNT: 2, // max line changes
  
  // Train behavior
  TRAIN_SPEED: 8, // grid units per second
  TRAIN_CAPACITY: 6, // passengers
  STATION_STOP_DURATION: 3, // seconds
  TRAINS_PER_LINE: 2, // starting train count
  
  // Costs
  STATION_COST: 100,
  LINE_SEGMENT_COST: 50,
  WATER_CROSSING_COST: 200,
  TRAIN_COST: 50,
  
  // Station capacity
  STATION_CAPACITY: 12, // max waiting passengers
};
```

## 7. Implementation Phases

### Phase 1: Map Generation
- Implement seeded RNG
- Water generation (river + archipelago)
- Density assignment algorithm
- Basic grid rendering
- Heatmap visualization toggle

### Phase 2: Station & Line Placement
- Station placement UI (snap to grid intersections)
- Line drawing tool (Harry Beck style)
- Cost calculation display
- Visual rendering of stations and lines

### Phase 3: Simulation Core
- Time system
- Passenger spawning logic
- Pathfinding algorithm
- Train movement and stopping
- Journey completion detection

### Phase 4: Game Loop Integration
- Pause/resume functionality
- Dynamic station/line addition while paused
- Score tracking
- Win/loss conditions (optional)

### Phase 5: Polish
- Visual effects (smooth animations)
- Sound effects (optional)
- Performance optimization
- UI/UX refinements

## 8. Technical Stack Recommendations

```typescript
// Suggested technologies
const TECH_STACK = {
  framework: 'React' or 'Vue' or 'Vanilla JS',
  rendering: 'HTML5 Canvas' or 'SVG',
  state: 'Redux' or 'Zustand' or 'local state',
  pathfinding: 'custom A* implementation',
  random: 'seedrandom.js library',
  styling: 'Tailwind CSS',
};
```

## 9. Data Persistence (Optional)

```typescript
interface SaveGame {
  seed: number;
  stations: Station[];
  lines: MetroLine[];
  score: number;
  infraCost: number;
  gameTime: number;
}

// LocalStorage save/load functionality
function saveGame(state: GameState): void;
function loadGame(saveId: string): GameState;
```

---

This specification provides a complete foundation for implementing a Mini Metro-style web game with all core mechanics, visual systems, and gameplay loops defined.