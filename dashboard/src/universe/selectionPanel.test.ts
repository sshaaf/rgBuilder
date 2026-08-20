import { describe, expect, it } from "vitest";
import type { BlastRadiusPayload } from "../types";
import {
  analysisAvailability,
  formatBlastMetrics,
  topHotspots,
} from "./contextPanelHelpers";
import {
  drillDownBlock,
  isBlastSectionVisible,
  layerInteractionHint,
  panelEyebrow,
  panelLocationPath,
} from "./selectionPanelHelpers";
import { navToL2, navToL3, navToL5 } from "./lodState";

describe("isBlastSectionVisible", () => {
  it("is hidden below L5", () => {
    expect(isBlastSectionVisible(1)).toBe(false);
    expect(isBlastSectionVisible(3)).toBe(false);
    expect(isBlastSectionVisible(4)).toBe(false);
  });

  it("is visible at L5", () => {
    expect(isBlastSectionVisible(5)).toBe(true);
  });
});

describe("panelEyebrow", () => {
  it("labels community and function modes", () => {
    expect(panelEyebrow(2)).toBe("Community");
    expect(panelEyebrow(5)).toBe("Function");
  });
});

describe("drillDownBlock", () => {
  it("blocks community_only bundles", () => {
    const block = drillDownBlock({ view: { community_only: true } } as never, [1, 2]);
    expect(block.blocked).toBe(true);
  });

  it("blocks empty member_indices", () => {
    const block = drillDownBlock(null, []);
    expect(block.blocked).toBe(true);
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
    ],
  };

  it("renders metrics from blast payload", () => {
    const view = formatBlastMetrics(payload);
    expect(view.directCallers).toBe(3);
    expect(view.risk).toBe("Medium");
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

describe("panelLocationPath", () => {
  it("shows overview at L1", () => {
    expect(panelLocationPath({ lod: 1 } as never, true)).toBe("Universe overview");
  });

  it("joins breadcrumb labels at deeper LOD", () => {
    const nav = navToL5(navToL3(navToL2(1, "core"), 2, "handlers"), "checkout");
    expect(panelLocationPath(nav, true)).toContain("core");
    expect(panelLocationPath(nav, true)).toContain("checkout");
  });
});

describe("layerInteractionHint", () => {
  it("describes L1 entry", () => {
    expect(layerInteractionHint(1, true)).toMatch(/community/i);
  });
});

describe("analysisAvailability", () => {
  it("reflects manifest analysis flags", () => {
    expect(
      analysisAvailability({
        cfg_available: true,
        dataflow_available: true,
      }),
    ).toMatchObject({ cfg: true, dataflow: true });
  });
});
