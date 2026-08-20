import type { BlastCallerEntry, BlastFunctionScore, BlastRadiusPayload } from "../types";
import type { LodLevel } from "./lodState";

export const CONTEXT_PANEL_WIDTH_PX = 280;
export const DEFAULT_BLAST_DEPTH = 5;

export function isContextPanelVisible(lod: LodLevel): boolean {
  return lod >= 3;
}

export function blastRiskLabel(score: number): "Low" | "Medium" | "High" {
  if (score >= 50) return "High";
  if (score >= 20) return "Medium";
  return "Low";
}

export interface BlastMetricsView {
  impactScore: number;
  directCallers: number;
  impactZone: number;
  depthLimit: number;
  risk: "Low" | "Medium" | "High";
}

export function formatBlastMetrics(
  payload: BlastRadiusPayload,
  indexScore?: BlastFunctionScore | null,
): BlastMetricsView {
  const impactScore = indexScore?.score ?? payload.score;
  return {
    impactScore,
    directCallers: indexScore?.direct ?? payload.direct_caller_count,
    impactZone: indexScore?.zone ?? payload.impact_zone_count,
    depthLimit: payload.depth_limit,
    risk: blastRiskLabel(impactScore),
  };
}

export function topHotspots(callers: BlastCallerEntry[], limit = 5): BlastCallerEntry[] {
  return [...callers]
    .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface AnalysisAvailability {
  cfg: boolean;
  slice: boolean;
  dataflow: boolean;
  taint: boolean;
  migration: boolean;
}

export function analysisAvailability(
  analysis: { cfg_available?: boolean; slice_available?: boolean; dataflow_available?: boolean; taint_available?: boolean; migration_available?: boolean } | undefined,
): AnalysisAvailability {
  return {
    cfg: analysis?.cfg_available === true,
    slice: analysis?.slice_available === true,
    dataflow: analysis?.dataflow_available === true,
    taint: analysis?.taint_available === true,
    migration: analysis?.migration_available === true,
  };
}
