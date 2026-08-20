import { describe, expect, it } from "vitest";
import type { SubgraphPayload } from "../types";
import { filterOneHopNeighborhood, layoutCallNeighborhood3d } from "./callNeighborhood3d";

const payload: SubgraphPayload = {
  nodes: [
    { index: 1, name: "seed", node_type: 0, node_type_name: "Function", complexity: 1 },
    { index: 2, name: "caller", node_type: 0, node_type_name: "Function", complexity: 1 },
    { index: 3, name: "callee", node_type: 0, node_type_name: "Function", complexity: 1 },
    { index: 4, name: "far", node_type: 0, node_type_name: "Function", complexity: 1 },
  ],
  edges: [
    { source: 2, target: 1, edge_type: 0 },
    { source: 1, target: 3, edge_type: 0 },
    { source: 4, target: 3, edge_type: 0 },
  ],
};

describe("filterOneHopNeighborhood", () => {
  it("keeps seed plus direct callers and callees", () => {
    const filtered = filterOneHopNeighborhood(payload, 1);
    expect(filtered.nodes.map((n) => n.index).sort()).toEqual([1, 2, 3]);
    expect(filtered.edges).toHaveLength(2);
  });
});

describe("layoutCallNeighborhood3d", () => {
  it("places seed at anchor", () => {
    const anchor = { x: 10, y: 0, z: -5 };
    const filtered = filterOneHopNeighborhood(payload, 1);
    const placements = layoutCallNeighborhood3d(filtered, 1, anchor);
    const seed = placements.find((p) => p.isSeed);
    expect(seed?.position).toEqual(anchor);
    expect(placements.length).toBe(3);
  });
});
