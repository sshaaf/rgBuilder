import { describe, expect, it } from "vitest";
import type { UniverseLayout } from "./types";

const minimalLayout: UniverseLayout = {
  schema_version: 1,
  communities: [
    {
      id: 0,
      label: "platform",
      color: "#3b82f6",
      position: { x: 0, y: 0, z: 0 },
      member_count: 10,
      glow_radius: 40,
    },
  ],
  bridges: [],
  packages: [],
};

describe("universe UI shell", () => {
  it("accepts universe layout schema shape", () => {
    expect(minimalLayout.communities[0].label).toBe("platform");
    expect(minimalLayout.schema_version).toBe(1);
  });
});
