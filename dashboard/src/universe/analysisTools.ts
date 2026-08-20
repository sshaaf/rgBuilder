import type { DashboardManifest } from "../types";
import { analysisAvailability } from "./contextPanelHelpers";

export type AnalysisToolId = "cfg" | "dataflow" | "slice" | "blast" | "migration" | "taint";

export interface AnalysisToolDef {
  id: AnalysisToolId;
  label: string;
  title: string;
  testId: string;
}

export const ANALYSIS_TOOLS: AnalysisToolDef[] = [
  { id: "cfg", label: "CFG", title: "Control-flow graphs", testId: "universe-tool-cfg" },
  { id: "dataflow", label: "Dataflow", title: "PDG / dataflow", testId: "universe-tool-dataflow" },
  { id: "slice", label: "Slice", title: "Program slicing", testId: "universe-tool-slice" },
  { id: "blast", label: "Blast", title: "Blast radius", testId: "universe-tool-blast" },
  { id: "migration", label: "Migration", title: "Migration planner", testId: "universe-tool-migration" },
  { id: "taint", label: "Taint", title: "Taint analysis", testId: "universe-tool-taint" },
];

export function availableAnalysisTools(manifest: DashboardManifest | null): AnalysisToolDef[] {
  const flags = analysisAvailability(manifest?.analysis);
  const blast = manifest?.analysis?.blast_available === true;
  return ANALYSIS_TOOLS.filter((tool) => {
    switch (tool.id) {
      case "cfg":
        return flags.cfg;
      case "dataflow":
        return flags.dataflow;
      case "slice":
        return flags.slice;
      case "blast":
        return blast;
      case "migration":
        return flags.migration;
      case "taint":
        return flags.taint;
      default:
        return false;
    }
  });
}

export function analysisToolById(id: AnalysisToolId): AnalysisToolDef | undefined {
  return ANALYSIS_TOOLS.find((t) => t.id === id);
}
