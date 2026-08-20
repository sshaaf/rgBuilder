import type { DashboardManifest, Metanode } from "../types";
import type { LodLevel, UniverseNavState } from "./lodState";
import { breadcrumbSegments, lodLabel } from "./lodState";
import type { UniverseBridge, UniverseLayout, UniversePackage, UniverseUnit } from "./types";

export function isBlastSectionVisible(lod: LodLevel): boolean {
  return lod === 5;
}

export function panelEyebrow(lod: LodLevel): string {
  switch (lod) {
    case 1:
      return "Universe";
    case 2:
      return "Community";
    case 3:
      return "Package";
    case 4:
      return "Class or file";
    case 5:
      return "Function";
    default:
      return "Selection";
  }
}

export function panelTitle(nav: UniverseNavState): string {
  switch (nav.lod) {
    case 1:
      return "Cosmos";
    case 2:
      return nav.communityLabel ?? "Community";
    case 3:
      return nav.packageLabel ?? "Package";
    case 4:
      return nav.unitLabel ?? "Unit";
    case 5:
      return nav.symbolName ?? "Function";
    default:
      return "Selection";
  }
}

export function panelSubtitle(
  nav: UniverseNavState,
  metanode: Metanode | undefined,
  unit?: UniverseUnit,
): string | null {
  if (nav.lod === 3 && metanode) {
    return `${metanode.functions} functions · ${metanode.classes} classes`;
  }
  if (nav.lod === 4 && unit) {
    return `${unit.kind} · ${unit.member_indices.length} members`;
  }
  if (nav.lod === 5 && nav.symbolName) {
    return nav.symbolName;
  }
  if (nav.lod === 2 && nav.communityLabel) {
    return `Louvain community · ${nav.communityLabel}`;
  }
  return null;
}

export function communityPackageCount(layout: UniverseLayout, communityId: number): number {
  return layout.packages.filter((p) => p.community_id === communityId).length;
}

export interface BridgeRow {
  label: string;
  weight: number;
  color: string;
}

export function communityBridges(
  layout: UniverseLayout,
  communityId: number,
  limit = 4,
): BridgeRow[] {
  const colorById = new Map(layout.communities.map((c) => [c.id, c.color]));
  const rows: BridgeRow[] = [];
  for (const b of layout.bridges) {
    if (b.source_community_id !== communityId && b.target_community_id !== communityId) {
      continue;
    }
    const otherId =
      b.source_community_id === communityId ? b.target_community_id : b.source_community_id;
    const other = layout.communities.find((c) => c.id === otherId);
    rows.push({
      label: `→ ${other?.label ?? otherId}`,
      weight: b.weight,
      color: other?.color ?? "#8B7CFF",
    });
  }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

export function findMetanode(metanodes: Metanode[], packageId: number): Metanode | undefined {
  return metanodes.find((n) => n.id === packageId);
}

export function findPackage(layout: UniverseLayout, packageId: number): UniversePackage | undefined {
  return layout.packages.find((p) => p.id === packageId);
}

export function findUnit(pkg: UniversePackage, unitId: number): UniverseUnit | undefined {
  return pkg.units?.find((u) => u.id === unitId);
}

export interface DrillDownBlock {
  blocked: boolean;
  message?: string;
}

export function drillDownBlock(
  manifest: DashboardManifest | null,
  memberIndices: number[] | undefined,
): DrillDownBlock {
  if (manifest?.view?.community_only) {
    return {
      blocked: true,
      message:
        "Community-only mode — per-function drill-down is unavailable for this repo size. Use search fly-to or run discover on a smaller scope.",
    };
  }
  if (!memberIndices || memberIndices.length === 0) {
    return {
      blocked: true,
      message:
        "No function indices in this package. Re-run discover with --with-universe on a repo below the community-only threshold.",
    };
  }
  return { blocked: false };
}

export function analysisSummary(manifest: DashboardManifest | null): string[] {
  const a = manifest?.analysis;
  if (!a) return [];
  const items: string[] = [];
  if (a.cfg_available) items.push("CFG");
  if (a.slice_available) items.push("Slice");
  if (a.dataflow_available) items.push("Dataflow");
  if (a.taint_available) items.push("Taint");
  if (a.migration_available) items.push("Migration");
  if (a.blast_available) items.push("Blast");
  return items;
}

/** Human-readable spatial path for the always-on context panel. */
export function panelLocationPath(nav: UniverseNavState, skipL4: boolean): string {
  const segments = breadcrumbSegments(nav, skipL4);
  if (segments.length <= 1) return "Universe overview";
  return segments.map((s) => s.label).join(" › ");
}

/** Short hint for what the user can do at the current LOD. */
export function layerInteractionHint(lod: LodLevel, skipL4: boolean): string {
  switch (lod) {
    case 1:
      return "Click a community in the cosmos to enter L2.";
    case 2:
      return "Click a package node to open L3.";
    case 3:
      return skipL4
        ? "Click a function in the 3D view to open blast analysis at L5."
        : "Click a class or file unit to enter L4, or pick a function if units are shown.";
    case 4:
      return "Click a function to open L5 — call neighborhood; use analysis icons on the left rail.";
    case 5:
      return "L5 function view — open analysis tools on the left rail (Blast, CFG, Dataflow, …).";
    default:
      return "";
  }
}
