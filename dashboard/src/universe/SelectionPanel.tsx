import type { DashboardManifest, Metanode } from "../types";
import type { UniverseNavState } from "./lodState";
import { canSkipL4, lodLabel } from "./lodState";
import {
  communityBridges,
  communityPackageCount,
  drillDownBlock,
  findMetanode,
  findPackage,
  findUnit,
  layerInteractionHint,
  panelEyebrow,
  panelLocationPath,
  panelSubtitle,
  panelTitle,
} from "./selectionPanelHelpers";
import type { UniverseLayout } from "./types";

export interface SelectionPanelProps {
  nav: UniverseNavState;
  layout: UniverseLayout | null;
  manifest: DashboardManifest | null;
  metanodes: Metanode[];
}

export function SelectionPanel({ nav, layout, manifest, metanodes }: SelectionPanelProps) {
  const pkg = nav.packageId != null && layout ? findPackage(layout, nav.packageId) : undefined;
  const unit = nav.unitId != null && pkg ? findUnit(pkg, nav.unitId) : undefined;
  const metanode = nav.packageId != null ? findMetanode(metanodes, nav.packageId) : undefined;
  const drillBlock = drillDownBlock(manifest, pkg?.member_indices);
  const skipL4 = canSkipL4(pkg);

  if (!layout) return null;

  const locEstimate =
    unit?.loc_estimate ?? pkg?.loc_estimate ?? (nav.lod === 3 ? metanode?.size : undefined);

  return (
    <aside
      class="universe-selection-panel glass"
      aria-labelledby="universe-panel-heading"
      data-testid="universe-selection-panel"
    >
      <div class="universe-panel-head">
        <div class="universe-panel-head-row">
          <span class="universe-panel-eyebrow">{panelEyebrow(nav.lod)}</span>
          <span class="universe-panel-beta">BETA</span>
        </div>
        <h2 id="universe-panel-heading" class="universe-panel-title">
          {panelTitle(nav)}
        </h2>
        {panelSubtitle(nav, metanode, unit) ? (
          <p class="universe-panel-sub">{panelSubtitle(nav, metanode, unit)}</p>
        ) : null}
      </div>

      <div class="universe-panel-body">
        <PanelLocation nav={nav} skipL4={skipL4} />

        <CosmosMetrics
          nav={nav}
          layout={layout}
          manifest={manifest}
          metanode={metanode}
          unit={unit}
          locEstimate={locEstimate}
        />

        {nav.lod === 3 && drillBlock.blocked ? (
          <p class="universe-context-muted universe-panel-warn" role="status">
            {drillBlock.message}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function PanelLocation({ nav, skipL4 }: { nav: UniverseNavState; skipL4: boolean }) {
  return (
    <section class="universe-panel-location" aria-label="Current location">
      <div class="universe-panel-lod" data-testid="universe-panel-lod">
        L{nav.lod} · {lodLabel(nav.lod)}
      </div>
      <p class="universe-panel-path">{panelLocationPath(nav, skipL4)}</p>
      <p class="universe-panel-hint">{layerInteractionHint(nav.lod, skipL4)}</p>
    </section>
  );
}

function CosmosMetrics({
  nav,
  layout,
  manifest,
  metanode,
  unit,
  locEstimate,
}: {
  nav: UniverseNavState;
  layout: UniverseLayout | null;
  manifest: DashboardManifest | null;
  metanode: Metanode | undefined;
  unit: ReturnType<typeof findUnit>;
  locEstimate: number | undefined;
}) {
  if (!layout && nav.lod === 1) return null;

  const rows: { label: string; value: string }[] = [];

  if (nav.lod === 1) {
    rows.push(
      {
        label: "Communities",
        value: String(manifest?.view?.community_count ?? layout?.communities.length ?? "—"),
      },
      { label: "Bridges", value: String(layout?.bridges.length ?? "—") },
      {
        label: "Graph nodes",
        value: String(manifest?.graph?.node_count ?? "—"),
      },
    );
  }

  if (nav.lod === 2 && nav.communityId != null && layout) {
    const community = layout.communities.find((c) => c.id === nav.communityId);
    rows.push(
      { label: "Members", value: String(community?.member_count ?? "—") },
      {
        label: "Packages",
        value: String(communityPackageCount(layout, nav.communityId)),
      },
    );
    const bridges = communityBridges(layout, nav.communityId);
    if (bridges.length > 0) {
      return (
        <>
          <ul class="universe-panel-metrics">
            {rows.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <b>{r.value}</b>
              </li>
            ))}
          </ul>
          <section class="universe-context-section">
            <h3 class="universe-context-section-title">Bridges</h3>
            <ul class="universe-panel-hotspots">
              {bridges.map((b) => (
                <li key={b.label}>
                  <span>
                    {b.label} · w={b.weight}
                  </span>
                  <span class="dot" style={{ background: b.color }} />
                </li>
              ))}
            </ul>
          </section>
        </>
      );
    }
  }

  if (nav.lod === 3 && metanode) {
    rows.push(
      { label: "Functions", value: String(metanode.functions) },
      { label: "Classes", value: String(metanode.classes) },
      { label: "Avg complexity", value: metanode.avg_complexity.toFixed(1) },
    );
    if (locEstimate != null && locEstimate > 0) {
      rows.push({ label: "Lines of code", value: locEstimate.toLocaleString("en-US") });
    }
  }

  if (nav.lod === 4 && unit) {
    rows.push(
      { label: "Unit kind", value: unit.kind },
      { label: "Members", value: String(unit.member_indices.length) },
    );
    if (unit.loc_estimate != null && unit.loc_estimate > 0) {
      rows.push({ label: "Lines of code", value: unit.loc_estimate.toLocaleString("en-US") });
    }
  }

  if (nav.lod === 5 && nav.symbolName) {
    rows.push({ label: "Function", value: nav.symbolName });
  }

  if (rows.length === 0) return null;

  return (
    <ul class="universe-panel-metrics">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </li>
      ))}
    </ul>
  );
}

/** @deprecated use SelectionPanel */
export const ContextPanel = SelectionPanel;
