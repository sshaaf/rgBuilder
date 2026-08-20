import type { SubgraphNode } from "../types";
import type { Vec3 } from "./types";

const GOLDEN = 2.399963229728653;

/** Camera distance threshold before L2 function geometry is shown (§8.8). */
export const L2_LAZY_DISTANCE = 200;

export interface L2NodePlacement {
  node: SubgraphNode;
  position: Vec3;
}

/** Deterministic 3D spiral (no Math.random). */
export function deterministicPositions3d(count: number, seed = 0): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = i * GOLDEN + seed * 0.17;
    const r = 4 + Math.sqrt(i + 1) * 2.2;
    const y = ((i % 7) - 3) * 1.6;
    out.push({
      x: Math.cos(angle) * r,
      y,
      z: Math.sin(angle) * r,
    });
  }
  return out;
}

export function layoutSubgraphNodes3d(
  nodes: SubgraphNode[],
  anchor: Vec3,
  seed = 0,
): L2NodePlacement[] {
  const local = deterministicPositions3d(nodes.length, seed);
  return nodes.map((node, i) => ({
    node,
    position: {
      x: anchor.x + local[i].x,
      y: anchor.y + local[i].y,
      z: anchor.z + local[i].z,
    },
  }));
}

export function shouldShowL2Nodes(
  cameraPosition: Vec3,
  anchor: Vec3,
  threshold = L2_LAZY_DISTANCE,
): boolean {
  const dx = cameraPosition.x - anchor.x;
  const dy = cameraPosition.y - anchor.y;
  const dz = cameraPosition.z - anchor.z;
  return dx * dx + dy * dy + dz * dz <= threshold * threshold;
}
