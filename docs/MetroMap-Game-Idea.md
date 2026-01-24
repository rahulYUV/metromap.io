Here are the technical specifications for the web-based Mini Metro-style simulation game.

### **Project Title:** MetroGrid Sim

**Platform:** Web (HTML5 Canvas / WebGL)
**Core Loop:** Procedural Map Generation  Infrastructure Construction  Passenger Simulation  Scoring.

---

## 1. Technology Stack Recommendation

* **Language:** TypeScript (for strong typing of grid coordinates and graph nodes).
* **Rendering Engine:** Pixi.js or Phaser (preferred for handling thousands of moving passenger sprites and vector line drawing). Alternatively, raw HTML5 Canvas API for lightweight implementation.
* **State Management:** Custom Game Loop Pattern (Tick-based).
* **Seed Logic:** `seedrandom.js` (or similar PRNG) to ensure the same seed produces the exact same map and spawning patterns.

---

## 2. Grid & Map Generation System

The map is the foundation of the simulation. It utilizes a grid coordinate system  where  and .

### 2.1. Coordinate System

* **Tiles (Density Data):** Defined by the center of squares. Total tiles: .
* **Vertices (Stations):** Defined by grid intersections. Total vertices: .
* **Edges (Tracks):** Connections between valid Vertices.

### 2.2. Procedural Algorithms (The Seed)

The seed controls three distinct generation layers:

1. **Terrain Layer (Water vs. Land):**
* **River Mode (50% chance):** Uses a "Drunkard's Walk" algorithm. Start at a random edge coordinate ( or  or  or ). Path random walks to the opposite side.
* *Width:* 1-2 tiles.
* *Bridge Cost:* Building a line across water incurs  infrastructure cost.


* **Archipelago Mode (50% chance):** Uses Perlin Noise with a cutoff threshold.
* If , tile is Water.
* *Validation:* A flood-fill algorithm runs post-generation to ensure  of the grid is Land. If the check fails, the seed is re-rolled internally.




2. **Residential Density Layer ():**
* Generated via Simplex Noise. Value normalized to integer .
* High values clustered together.


3. **Commercial Density Layer ():**
* Generated via Simplex Noise (offset from Residential seed).
* **Logic:** While independent, the algorithm biases generation such that  is low, preventing too many tiles from being 100/100, though allowing occasional mixed-use zones.



---

## 3. Game Objects & Data Models

### 3.1. Stations (Nodes)

Stations are placed by the user on **Grid Intersections**.

* **Properties:**
* `id`: UUID
* `position`:  (Integer intersection coordinates)
* `passengerQueue`: Array of waiting Agents.
* `connectedLines`: Array of Line IDs passing through this station.



### 3.2. Lines (Edges)

Lines follow "Harry Beck" visualization rules.

* **Constraints:**
* Must connect two Stations.
* Segments must be Horizontal (), Vertical (), or Diagonal ().
* **Immutability:** Once the `buildLine()` transaction is committed, the line object is locked. `isEditable = false`.


* **Rendering:** Bezier curves are used only at vertices to visually smooth the 90/45 degree turns, but logic remains grid-based.

### 3.3. Passengers (Agents)

* **Properties:**
* `origin`: Station ID
* `destination`: Station ID
* `spawnTime`: Timestamp
* `currentLine`: Line ID (if on train)



---

## 4. Simulation Mechanics

### 4.1. The Time Cycle

The game runs on a 24-hour cycle loop (e.g., 1 real-world second = 10 in-game minutes).

* **Global Variable:** 

### 4.2. Spawning Algorithm

Spawning is probabilistic based on Tile Density and Time of Day.

**Variables:**

* : Current time of day (0-24).
* : Aggregate residential density surrounding Station .
* : Aggregate commercial density surrounding Station .

**Logic:**

1. **Morning Rush (06:00 - 10:00):**
* Spawn probability at Station  increases relative to .
* Destination probability is weighted heavily toward stations with high .


2. **Evening Rush (16:00 - 20:00):**
* Spawn probability at Station  increases relative to .
* Destination probability is weighted heavily toward stations with high .


3. **Off-Peak:** Lower overall spawn rate, random distribution.

### 4.3. Cost & Score

* **Infrastructure Cost (The Budget):**


* *Note:* The game tracks this to enforce the "Lowest Infra Cost" principle, perhaps giving a rank/grade based on Cost per Journey.


* **Scoring:**
* Event listener triggers `score++` when `Agent.location == Agent.destination`.



---

## 5. Visualizer & UI Specs

### 5.1. The Heatmap Toggle

A specialized view mode overlaying the grid.

* **Implementation:** Render a semi-transparent colored tile over every grid square.
* **Color Mixing:**
* Residential (): Green Channel.
* Commercial (): Red Channel.
* Result: High Home = Bright Green. High Office = Bright Red. Mixed = Yellow/Brown. Low Density = Transparent/Black.



### 5.2. Build Mode vs. Run Mode

* **Pause State:** The game clock stops.
* Mouse click on intersection  Place Station.
* Drag from Station A to Station B  Pathfinding algorithm checks for valid 45/90 degree path. If valid, renders "Ghost Line". Mouse Up confirms build.


* **Run State:**
* Disables Station placement and Line drawing.
* Animates Agents (circles) moving along lines.



---

## 6. Pathfinding Implementation (Backend Logic)

Since lines cannot be deleted, the graph is **Append-Only**.

**Agent Routing:**
When an agent spawns at Station A with destination Station B:

1. Run **Dijkstra’s Algorithm** or **BFS** on the Station Graph.
2. Edge weights can be uniform (1) or based on physical length.
3. If no path exists, Agent waits (and eventually despawns/fails).
4. If path exists, Agent pushes to `Station[A].queue`.

---

## 7. Future Considerations (V2)

* **Capacity Limits:** Trains and stations having max capacity (game over if overcrowding occurs).
* **Line Editing:** Introducing a currency cost to "demolish" lines rather than strict immutability.

---

### Would you like me to generate the TypeScript interface definitions for the `Station` and `Line` objects to help you start coding?