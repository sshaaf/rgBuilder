import type { SearchLandmark, UniverseCommunity, Vec3 } from "./types";

export type SearchResultKind = "landmark" | "community" | "semantic";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  label: string;
  sublabel?: string;
  communityId?: number;
  position: Vec3;
  nodeIndex?: number;
}

export interface CommunityRow {
  id: number;
  label: string;
  color: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matchesQuery(text: string, q: string): boolean {
  return norm(text).includes(norm(q));
}

export function searchLocal(
  query: string,
  landmarks: SearchLandmark[],
  communities: CommunityRow[],
  layoutCommunities: UniverseCommunity[],
  limit = 12,
): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const posByCommunity = new Map(layoutCommunities.map((c) => [c.id, c.position]));
  const out: SearchResult[] = [];
  const seen = new Set<string>();

  for (const c of communities) {
    if (!matchesQuery(c.label, q)) continue;
    const key = `community:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const position = posByCommunity.get(c.id) ?? { x: 0, y: 0, z: 0 };
    out.push({
      id: key,
      kind: "community",
      label: c.label,
      sublabel: "Community",
      communityId: c.id,
      position,
    });
  }

  for (const lm of landmarks) {
    if (!matchesQuery(lm.name, q) && !matchesQuery(lm.qualified_name, q)) continue;
    const key = `landmark:${lm.node_index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      kind: "landmark",
      label: lm.name,
      sublabel: lm.qualified_name,
      communityId: lm.community_id ?? undefined,
      position: lm.position,
      nodeIndex: lm.node_index,
    });
  }

  return out.slice(0, limit);
}

export function mapSemanticHitToResult(
  hit: { name: string; qualified_name?: string | null },
  landmarks: SearchLandmark[],
  layoutCommunities: UniverseCommunity[],
): SearchResult | null {
  const qn = hit.qualified_name?.trim();
  const lm =
    landmarks.find((l) => qn && l.qualified_name === qn) ??
    landmarks.find((l) => l.name === hit.name);
  if (lm) {
    return {
      id: `semantic:${lm.node_index}`,
      kind: "semantic",
      label: lm.name,
      sublabel: lm.qualified_name,
      communityId: lm.community_id ?? undefined,
      position: lm.position,
      nodeIndex: lm.node_index,
    };
  }
  const cid = layoutCommunities[0]?.id;
  if (cid == null) return null;
  const community = layoutCommunities.find((c) => c.id === cid);
  if (!community) return null;
  return {
    id: `semantic:name:${hit.name}`,
    kind: "semantic",
    label: hit.name,
    sublabel: qn ?? hit.name,
    communityId: community.id,
    position: community.position,
  };
}
