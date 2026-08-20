import { describe, expect, it } from "vitest";
import { availableAnalysisTools } from "./analysisTools";

describe("availableAnalysisTools", () => {
  it("filters by manifest analysis flags", () => {
    const tools = availableAnalysisTools({
      analysis: {
        cfg_available: true,
        dataflow_available: true,
        blast_available: true,
        migration_available: false,
        slice_available: true,
        taint_available: false,
      },
    } as never);
    expect(tools.map((t) => t.id)).toEqual(["cfg", "dataflow", "slice", "blast"]);
  });
});
