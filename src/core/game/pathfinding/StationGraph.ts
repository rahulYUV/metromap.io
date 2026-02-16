/**
 * Station Graph for Pathfinding
 * Models the metro network as a graph to find routes between stations.
 */

import type { MetroLine } from "../models/MetroLine";
import type { Station } from "../models/Station";

interface GraphNode {
  stationId: string;
  connections: GraphEdge[];
}

interface GraphEdge {
  targetStationId: string;
  lineId: string;
}

/**
 * Find a route between two stations using BFS
 * Returns a list of station IDs representing the path (waypoints)
 */
export function findRoute(
  startId: string,
  endId: string,
  stations: Station[],
  lines: MetroLine[],
): string[] | null {
  if (startId === endId) return [];

  // Build the graph
  const graph = buildGraph(stations, lines);

  // BFS
  const queue: { stationId: string; path: string[] }[] = [];
  const visited = new Set<string>();

  queue.push({ stationId: startId, path: [startId] });
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { stationId, path } = current;

    if (stationId === endId) {
      return path;
    }

    const node = graph.get(stationId);
    if (!node) continue;

    for (const edge of node.connections) {
      if (!visited.has(edge.targetStationId)) {
        visited.add(edge.targetStationId);
        queue.push({
          stationId: edge.targetStationId,
          path: [...path, edge.targetStationId],
        });
      }
    }
  }

  return null; // No path found
}

/**
 * Build an adjacency list representation of the metro network
 */
function buildGraph(
  stations: Station[],
  lines: MetroLine[],
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  // Initialize nodes
  for (const station of stations) {
    graph.set(station.id, { stationId: station.id, connections: [] });
  }

  // Add edges from lines
  for (const line of lines) {
    if (line.stationIds.length < 2) continue;

    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const fromId = line.stationIds[i];
      const toId = line.stationIds[i + 1];

      const fromNode = graph.get(fromId);
      const toNode = graph.get(toId);

      if (fromNode && toNode) {
        // Add bidirectional connection
        // Note: In a real directed graph (one-way lines), this would be different.
        // Assuming bidirectional lines for now.
        fromNode.connections.push({ targetStationId: toId, lineId: line.id });
        toNode.connections.push({ targetStationId: fromId, lineId: line.id });
      }
    }

    // Handle Loop closing (last -> first)
    if (line.isLoop && line.stationIds.length > 2) {
      const lastId = line.stationIds[line.stationIds.length - 1];
      const firstId = line.stationIds[0];

      const lastNode = graph.get(lastId);
      const firstNode = graph.get(firstId);

      if (lastNode && firstNode) {
        lastNode.connections.push({
          targetStationId: firstId,
          lineId: line.id,
        });
        firstNode.connections.push({
          targetStationId: lastId,
          lineId: line.id,
        });
      }
    }
  }

  return graph;
}
