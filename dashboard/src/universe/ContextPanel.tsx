import { useEffect, useState } from "preact/hooks";
import type {
  AnalysisSection,
  BlastFunctionScore,
  BlastRadiusPayload,
  DashboardManifest,
} from "../types";
import { bundleDataUrl } from "../bundleUrl";
import {
  analysisAvailability,
  DEFAULT_BLAST_DEPTH,
  formatBlastMetrics,
  isContextPanelVisible,
  topHotspots,
} from "./contextPanelHelpers";
import type { LodLevel } from "./lodState";

export interface SelectedSymbol {
  nodeIndex: number;
  name: string;
}

export interface ContextPanelProps {
  lod: LodLevel;
  manifest: DashboardManifest | null;
  symbol: SelectedSymbol | null;
  wasmReady: boolean;
  blastRadius: (nodeIndex: number, maxDepth: number) => Promise<BlastRadiusPayload>;
}

export function ContextPanel({
  lod,
  manifest,
  symbol,
  wasmReady,
  blastRadius,
}: ContextPanelProps) {
  const visible = isContextPanelVisible(lod);
  const [blast, setBlast] = useState<BlastRadiusPayload | null>(null);
  const [indexScore, setIndexScore] = useState<BlastFunctionScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = manifest?.analysis;
  const availability = analysisAvailability(analysis);

  useEffect(() => {
    if (!symbol || !analysis?.blast_available) {
      setIndexScore(null);
      return;
    }
    let cancelled = false;
    fetch(bundleDataUrl("blast_index.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { functions?: BlastFunctionScore[] } | null) => {
        if (cancelled || !data?.functions) return;
        setIndexScore(data.functions.find((f) => f.index === symbol.nodeIndex) ?? null);
      })
      .catch(() => {
        if (!cancelled) setIndexScore(null);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol?.nodeIndex, analysis?.blast_available]);

  useEffect(() => {
    if (!visible || !symbol || !wasmReady) {
      setBlast(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void blastRadius(symbol.nodeIndex, DEFAULT_BLAST_DEPTH)
      .then((payload) => {
        if (!cancelled) setBlast(payload);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setBlast(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, symbol?.nodeIndex, wasmReady, blastRadius]);

  if (!visible) return null;

  const metrics = blast ? formatBlastMetrics(blast, indexScore) : null;
  const hotspots = blast ? topHotspots(blast.callers) : [];

  return (
    <aside
      class="universe-context-panel"
      aria-labelledby="universe-blast-heading"
      data-testid="universe-context-panel"
    >
      <header class="universe-context-header">
        <h2 id="universe-blast-heading" class="universe-context-title">
          BLAST RADIUS
        </h2>
        {symbol ? <p class="universe-context-symbol">{symbol.name}</p> : null}
      </header>

      {!wasmReady ? (
        <p class="universe-context-muted">WASM engine required for blast analysis.</p>
      ) : loading ? (
        <p class="universe-context-muted" role="status">
          Analyzing blast radius…
        </p>
      ) : error ? (
        <p class="universe-context-error" role="alert">
          {error}
        </p>
      ) : metrics && blast ? (
        <>
          <dl class="universe-context-metrics">
            <div>
              <dt>Impact score</dt>
              <dd>{metrics.impactScore.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Direct callers</dt>
              <dd>{metrics.directCallers}</dd>
            </div>
            <div>
              <dt>Impact zone</dt>
              <dd>{metrics.impactZone}</dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd class={`universe-risk universe-risk--${metrics.risk.toLowerCase()}`}>
                {metrics.risk}
              </dd>
            </div>
          </dl>

          <section class="universe-context-section">
            <h3 class="universe-context-section-title">Hotspots</h3>
            {hotspots.length === 0 ? (
              <p class="universe-context-muted">No upstream callers within depth {metrics.depthLimit}.</p>
            ) : (
              <ul class="universe-context-hotspots">
                {hotspots.map((c) => (
                  <li key={`${c.index}-${c.depth}`}>
                    <span class="universe-hotspot-depth">d{c.depth}</span>
                    <span class="universe-hotspot-name">{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section class="universe-context-section">
            <h3 class="universe-context-section-title">Callers</h3>
            <div class="universe-context-table-wrap">
              <table class="universe-context-table">
                <thead>
                  <tr>
                    <th>Depth</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {blast.callers.length === 0 ? (
                    <tr>
                      <td colSpan={2} class="universe-context-muted">
                        None
                      </td>
                    </tr>
                  ) : (
                    blast.callers.slice(0, 12).map((c) => (
                      <tr key={`${c.index}-${c.depth}`}>
                        <td>{c.depth}</td>
                        <td>{c.name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p class="universe-context-muted">Select a function in the neighborhood view.</p>
      )}

      <AnalysisInsets analysis={analysis} availability={availability} />
    </aside>
  );
}

function AnalysisInsets({
  analysis,
  availability,
}: {
  analysis: AnalysisSection | undefined;
  availability: ReturnType<typeof analysisAvailability>;
}) {
  const items: { key: string; label: string; detail?: string }[] = [];
  if (availability.cfg) {
    items.push({
      key: "cfg",
      label: "CFG",
      detail: analysis?.cfg_function_count
        ? `${analysis.cfg_function_count} functions indexed`
        : undefined,
    });
  }
  if (availability.slice) {
    items.push({
      key: "slice",
      label: "Slice",
      detail: analysis?.slice_function_count
        ? `${analysis.slice_function_count} functions indexed`
        : undefined,
    });
  }
  if (availability.dataflow) {
    items.push({
      key: "dataflow",
      label: "Dataflow",
      detail: analysis?.dataflow_function_count
        ? `${analysis.dataflow_function_count} functions indexed`
        : undefined,
    });
  }
  if (availability.taint) {
    items.push({
      key: "taint",
      label: "Taint",
      detail: analysis?.taint_flow_count
        ? `${analysis.taint_flow_count} flows`
        : undefined,
    });
  }
  if (availability.migration) {
    items.push({ key: "migration", label: "Migration" });
  }

  if (items.length === 0) return null;

  return (
    <section class="universe-context-section universe-context-insets">
      <h3 class="universe-context-section-title">Analysis</h3>
      <ul class="universe-context-inset-list">
        {items.map((item) => (
          <li key={item.key}>
            <span class="universe-inset-label">{item.label}</span>
            {item.detail ? <span class="universe-context-muted">{item.detail}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
