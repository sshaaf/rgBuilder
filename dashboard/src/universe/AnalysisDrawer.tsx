import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { BlastView } from "../BlastView";
import { CfgView } from "../CfgView";
import { DataflowView } from "../DataflowView";
import { MigrationView } from "../MigrationView";
import { SliceView } from "../SliceView";
import { TaintView } from "../TaintView";
import type {
  BlastRadiusPayload,
  CfgDetailPayload,
  DashboardManifest,
  DataflowGraphPayload,
  SliceDirection,
  SliceResultPayload,
} from "../types";
import { analysisToolById, type AnalysisToolId } from "./analysisTools";

export interface AnalysisDrawerProps {
  tool: AnalysisToolId | null;
  onClose: () => void;
  manifest: DashboardManifest | null;
  wasmReady: boolean;
  functionCount: number;
  listNodes: (
    typeMask: number,
    offset: number,
    limit: number,
  ) => Promise<import("../types").NodeListPayload>;
  blastRadius: (nodeIndex: number, maxDepth: number) => Promise<BlastRadiusPayload>;
  loadCfgDetail: (functionId: string) => Promise<CfgDetailPayload>;
  computeDataflow: (
    functionId: string,
    variable: string | null,
    includeControl: boolean,
  ) => Promise<DataflowGraphPayload>;
  computeSlice: (
    functionId: string,
    line: number,
    variable: string,
    direction: SliceDirection,
  ) => Promise<SliceResultPayload>;
}

export function AnalysisDrawer({
  tool,
  onClose,
  manifest,
  wasmReady,
  functionCount,
  listNodes,
  blastRadius,
  loadCfgDetail,
  computeDataflow,
  computeSlice,
}: AnalysisDrawerProps) {
  if (!tool) return null;

  const def = analysisToolById(tool);
  if (!def) return null;

  return (
    <aside
      class="universe-analysis-drawer glass"
      aria-labelledby="universe-analysis-heading"
      data-testid="universe-analysis-drawer"
      data-tool={tool}
    >
      <div class="universe-analysis-drawer-head">
        <div>
          <span class="universe-analysis-drawer-eyebrow">Analysis</span>
          <h2 id="universe-analysis-heading" class="universe-analysis-drawer-title">
            {def.label}
          </h2>
          <p class="universe-analysis-drawer-sub">{def.title}</p>
        </div>
        <button
          type="button"
          class="universe-analysis-drawer-close"
          aria-label="Close analysis panel"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div class="universe-analysis-drawer-body rb-tab-workspace">
        {!manifest ? (
          <p class="p-3 text-muted">Loading bundle…</p>
        ) : tool === "cfg" ? (
          <CfgView wasmReady={wasmReady} loadCfgDetail={loadCfgDetail} />
        ) : tool === "dataflow" ? (
          <DataflowView wasmReady={wasmReady} loadCfgDetail={loadCfgDetail} />
        ) : tool === "slice" ? (
          <SliceView computeSlice={computeSlice} />
        ) : tool === "blast" ? (
          <BlastView
            wasmReady={wasmReady}
            functionCount={functionCount}
            listNodes={listNodes}
            blastRadius={blastRadius}
          />
        ) : tool === "migration" ? (
          <MigrationView />
        ) : tool === "taint" ? (
          <TaintView />
        ) : null}
      </div>
    </aside>
  );
}
