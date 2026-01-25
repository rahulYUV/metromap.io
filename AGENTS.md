# MetroMap.io - Agent Context Guide

## Game Concept
A Mini Metro-style simulation game where players design metro systems. Core gameplay loop:
1. **Map Generation**: Procedural maps with residential/commercial density zones and water features
2. **Infrastructure Building**: Place stations at grid intersections and draw metro lines (horizontal/vertical/diagonal only)
3. **Simulation**: Passengers spawn based on time-of-day and density, travel via pathfinding, complete journeys for score
4. **Optimization**: Minimize infrastructure cost while maximizing passenger journeys completed

## Tech Stack
- **Language**: TypeScript
- **Rendering**: Pixi.js v8 (2D Canvas/WebGL graphics engine)
- **Build Tool**: Vite
- **State Management**: Custom game loop with tick-based updates
- **UI Components**: @pixi/ui for interactive elements
- **Linting**: ESLint with Prettier

## Code Structure

### `/src/main.ts`
Entry point - initializes CreationEngine, shows LoadScreen → MapPickerScreen

### `/src/engine/`
Core game engine infrastructure (not game-specific):
- `engine.ts` - CreationEngine class (extends Pixi Application)
- `navigation/` - Screen navigation system
- `resize/` - Canvas resize handling
- `audio/` - Sound management (@pixi/sound)

### `/src/app/game/`
**Core game logic** - most game development happens here:
- `MapGenerator.ts` - Procedural map generation (terrain, density layers using seeded random)
- `MapRenderer.ts` - Renders grid, water, land, heatmaps using Pixi graphics
- `models/` - Core data structures:
  - `MapGrid.ts` - 48×32 grid with land/water and density data
  - `Station.ts` - Metro stations at grid intersections
  - `MetroLine.ts` - Metro lines connecting stations
  - `GameState.ts` - Overall game state container
- `pathfinding/` - A*/Dijkstra for passenger routing between stations
- `index.ts` - Game exports

### `/src/app/screens/`
Game screens (Pixi containers managed by navigation system):
- `LoadScreen.ts` - Initial loading screen
- `MapPickerScreen.ts` - Seed input and map generation UI
- `MetroBuildingScreen.ts` - Main gameplay screen (station placement, line drawing, simulation)
- `main/` - Additional screens

### `/src/app/ui/`
Reusable UI components built on @pixi/ui:
- `Button.ts`, `FlatButton.ts` - Interactive buttons
- `Label.ts` - Text labels
- `RoundedBox.ts` - Container with rounded corners
- `VolumeSlider.ts` - Audio control

### `/src/app/popups/`
Modal dialogs and overlays

### `/src/app/utils/`
Utility functions and helpers:
- `userSettings.ts` - Persistent user preferences

## Key Game Mechanics (from specs)

### Grid System
- **48×32 grid squares** for density data (land/water, residential/office values 0-100)
- **49×33 vertices** (grid intersections) for station placement
- Coordinates use top-left origin (0,0)

### Map Generation
- **Seeded RNG** ensures reproducibility (same seed = same map)
- **Terrain**: 50% chance River (drunkard's walk) or Archipelago (Perlin noise)
- **Density Layers**: Simplex noise for residential/commercial clustering with inverse correlation

### Infrastructure
- **Stations**: Placed on grid intersections, have passenger queues
- **Lines**: Connect stations with 0°/45°/90° segments (Harry Beck style), immutable once built
- **Cost Tracking**: Stations, line segments, water crossings

### Simulation
- **24-hour time cycle** (accelerated time)
- **Passenger spawning**: Probabilistic based on density and time
  - Morning rush: Residential → Commercial
  - Evening rush: Commercial → Residential
- **Pathfinding**: BFS/Dijkstra on station graph
- **Scoring**: Journey completions tracked

## Development Workflow

### Running Locally
```bash
npm install
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Run ESLint
```

### File Modification Guidelines
- **Game logic changes**: Work in `/src/app/game/`
- **New screens**: Add to `/src/app/screens/`
- **UI components**: Extend `/src/app/ui/`
- **Engine changes**: Only modify `/src/engine/` for infrastructure needs

### Common Tasks
- **Add station logic**: Modify `models/Station.ts` + `MapRenderer.ts`
- **Change map generation**: Edit `MapGenerator.ts` (uses seedrandom patterns)
- **Update pathfinding**: Work in `pathfinding/` directory
- **New UI screen**: Create in `screens/`, register with navigation
- **Tweak visuals**: Adjust Pixi graphics in `MapRenderer.ts` or screen files

## Important Constraints
- Lines must follow 0°/45°/90° angles (Harry Beck transit map style)
- Stations snap to grid intersections only
- Lines are immutable after placement (no deletion in current version)
- Water crossings cost more infrastructure points
- Passenger destinations are shape-coded (circle/square/triangle)

## Where to Find What
- **Map data structures**: `app/game/models/MapGrid.ts`
- **Rendering logic**: `app/game/MapRenderer.ts`
- **Generation algorithms**: `app/game/MapGenerator.ts`
- **Player interactions**: `app/screens/MetroBuildingScreen.ts`
- **Passenger simulation**: (To be implemented in `GameState.ts` + simulation loop)
- **Line drawing UI**: `app/screens/MetroBuildingScreen.ts`
- **Pathfinding**: `app/game/pathfinding/`
