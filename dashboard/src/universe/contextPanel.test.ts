import { describe, expect, it } from "vitest";
import type { BlastRadiusPayload } from "../types";
import {
  analysisAvailability,
  formatBlastMetrics,
  isContextPanelVisible,
  topHotspots,
} from "./contextPanelHelpers";

describe("isContextPanelVisible", () => {
  it("is hidden below L3", () => {
    expect(isContextPanelVisible(0)).toBe(false);
    expect(isContextPanelVisible(1)).toBe(false);
    expect(isContextPanelVisible(2)).toBe(false);
  });

  it("is visible at L3", () => {
    expect(isContextPanelVisible(3)).toBe(true);
  });
});

describe("formatBlastMetrics", () => {
  const payload: BlastRadiusPayload = {
    seed_index: 9,
    seed_name: "OrderService.checkout",
    depth_limit: 5,
    direct_caller_count: 3,
    impact_zone_count: 18,
    score: 24.5,
    callers: [
      { index: 1, name: "CartController", depth: 1, node_type: 0, node_type_name: "Function" },
      { index: 2, name: "PaymentGateway", depth: 2, node_type: 0, node_type_name: "Function" },
    ],
  };

  it("renders metrics from blast payload", () => {
    const view = formatBlastMetrics(payload);
    expect(view.directCallers).toBe(3);
    expect(view.impactZone).toBe(18);
    expect(view.risk).toBe("Medium");
  });

  it("prefers index score when provided", () => {
    const view = formatBlastMetrics(payload, { index: 9, score: 72, direct: 8, zone: 40 });
    expect(view.impactScore).toBe(72);
    expect(view.risk).toBe("High");
  });
});

describe("topHotspots", () => {
  it("orders by depth then name", () => {
    const hotspots = topHotspots([
      { index: 2, name: "Zeta", depth: 2, node_type: 0, node_type_name: "Function" },
      { index: 1, name: "Alpha", depth: 1, node_type: 0, node_type_name: "Function" },
    ]);
    expect(hotspots[0].name).toBe("Alpha");
  });
});

describe("analysisAvailability", () => {
  it("reflects manifest analysis flags", () => {
    expect(
      analysisAvailability({
        cfg_available: true,
        slice_available: false,
        dataflow_available: true,
        taint_available: false,
      }),
    ).toEqual({
      cfg: true,
      slice: false,
      dataflow: true,
      taint: false,
      migration: false,
    });
  });
});
