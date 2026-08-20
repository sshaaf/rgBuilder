import { bundleDataUrl } from "../bundleUrl";
import type { MigrationGraphPayload } from "../migration/types";
import type { SearchLandmark } from "./types";
import type { TaintIndexPayload } from "../types";

export async function loadMigrationGraph(): Promise<MigrationGraphPayload | null> {
  const res = await fetch(bundleDataUrl("migration_graph.json"));
  if (!res.ok) return null;
  return (await res.json()) as MigrationGraphPayload;
}

export async function loadTaintIndex(): Promise<TaintIndexPayload | null> {
  const res = await fetch(bundleDataUrl("taint_index.json"));
  if (!res.ok) return null;
  return (await res.json()) as TaintIndexPayload;
}

/** Top migration hotspots by max blast radius (package macro communities). */
export function migrationHotspotCommunityIds(
  graph: MigrationGraphPayload,
  topN = 8,
): number[] {
  return [...graph.communities]
    .sort((a, b) => b.max_blast - a.max_blast)
    .slice(0, topN)
    .map((c) => c.id);
}

/** Map tainted function names to community ids via search landmarks. */
export function taintCommunityIds(
  taint: TaintIndexPayload,
  landmarks: SearchLandmark[],
): number[] {
  if (!taint.available || taint.vulnerable_flows <= 0) return [];
  const vulnerable = new Set(
    taint.functions.filter((f) => f.vulnerable_count > 0).map((f) => f.name),
  );
  const ids = new Set<number>();
  for (const lm of landmarks) {
    if (lm.community_id == null) continue;
    if (vulnerable.has(lm.name)) ids.add(lm.community_id);
  }
  return [...ids];
}

/** Pairs of taint-affected communities connected by universe bridges. */
export function taintBridgePairs(
  taintCommunityIds: number[],
  bridges: { source_community_id: number; target_community_id: number }[],
): [number, number][] {
  const taint = new Set(taintCommunityIds);
  const pairs: [number, number][] = [];
  for (const b of bridges) {
    if (taint.has(b.source_community_id) && taint.has(b.target_community_id)) {
      pairs.push([b.source_community_id, b.target_community_id]);
    }
  }
  return pairs;
}
