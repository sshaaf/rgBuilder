import type { SubgraphNode, SubgraphPayload } from "../types";
import type { Vec3 } from "./types";

/** Columnar CALLS edge type (matches WASM columnar.rs). */
export const CALLS_EDGE_TYPE = 0;

export function filterOneHopNeighborhood(
  payload: SubgraphPayload,
  seedIndex: number,
): SubgraphPayload {
  const related = new Set<number>([seedIndex]);
  for (const edge of payload.edges) {
    if (edge.edge_type !== CALLS_EDGE_TYPE) continue;
    if (edge.source === seedIndex) related.add(edge.target);
    if (edge.target === seedIndex) related.add(edge.source);
  }
  const nodes = payload.nodes.filter((n) => related.has(n.index));
  const nodeSet = new Set(nodes.map((n) => n.index));
  const edges = payload.edges.filter(
    (e) =>
      e.edge_type === CALLS_EDGE_TYPE &&
      nodeSet.has(e.source) &&
      nodeSet.has(e.target),
  );
  return { nodes, edges };
}

export interface NeighborhoodPlacement {
  node: SubgraphNode;
  position: Vec3;
  isSeed: boolean;
}

/** Radial 3D layout: seed at center, neighbors on a ring. */
export function layoutCallNeighborhood3d(
  payload: SubgraphPayload,
  seedIndex: number,
  anchor: Vec3,
): NeighborhoodPlacement[] {
  const seed = payload.nodes.find((n) => n.index === seedIndex);
  if (!seed) return [];

  const others = payload.nodes.filter((n) => n.index !== seedIndex);
  const count = others.length;
  const out: NeighborhoodPlacement[] = [
    {
      node: seed,
      position: { ...anchor },
      isSeed: true,
    },
  ];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 + seedIndex * 0.11;
    const r = 14 + Math.sqrt(i + 1) * 3.5;
    out.push({
      node: others[i],
      position: {
        x: anchor.x + Math.cos(angle) * r,
        y: anchor.y + ((i % 5) - 2) * 2.2,
        z: anchor.z + Math.sin(angle) * r,
      },
      isSeed: false,
    });
  }
  return out;
}

export function neighborhoodEdges(
  payload: SubgraphPayload,
  positions: Map<number, Vec3>,
): { from: Vec3; to: Vec3 }[] {
  const lines: { from: Vec3; to: Vec3 }[] = [];
  for (const edge of payload.edges) {
    if (edge.edge_type !== CALLS_EDGE_TYPE) continue;
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (from && to) lines.push({ from, to });
  }
  return lines;
}
