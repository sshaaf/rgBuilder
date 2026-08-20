import { describe, expect, it } from "vitest";
import {
  deterministicPositions3d,
  layoutSubgraphNodes3d,
  L2_LAZY_DISTANCE,
  shouldShowL2Nodes,
} from "./nodeLayout3d";

describe("deterministicPositions3d", () => {
  it("is stable for the same seed", () => {
    expect(deterministicPositions3d(5, 3)).toEqual(deterministicPositions3d(5, 3));
  });

  it("scales with count", () => {
    expect(deterministicPositions3d(12, 1)).toHaveLength(12);
  });
});

describe("layoutSubgraphNodes3d", () => {
  it("offsets nodes from package anchor", () => {
    const anchor = { x: 100, y: 0, z: 50 };
    const nodes = [
      {
        index: 1,
        name: "foo",
        node_type: 0,
        node_type_name: "Function",
        complexity: 2,
      },
      {
        index: 2,
        name: "bar",
        node_type: 0,
        node_type_name: "Function",
        complexity: 1,
      },
    ];
    const placed = layoutSubgraphNodes3d(nodes, anchor, 9);
    expect(placed).toHaveLength(2);
    expect(placed[0].position.x).not.toBe(anchor.x);
    expect(placed[0].node.name).toBe("foo");
  });
});

describe("shouldShowL2Nodes", () => {
  it("shows when camera is near anchor", () => {
    const anchor = { x: 0, y: 0, z: 0 };
    const near = { x: 10, y: 0, z: 10 };
    expect(shouldShowL2Nodes(near, anchor, L2_LAZY_DISTANCE)).toBe(true);
  });

  it("hides when camera is far", () => {
    const anchor = { x: 0, y: 0, z: 0 };
    const far = { x: 500, y: 0, z: 500 };
    expect(shouldShowL2Nodes(far, anchor, L2_LAZY_DISTANCE)).toBe(false);
  });
});
