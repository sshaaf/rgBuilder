import type { MetagraphPayload } from "../types";
import type { SearchLandmarksPayload, UniverseLayout } from "./types";
import { bundleDataUrl } from "../bundleUrl";

export async function loadMetagraph(): Promise<MetagraphPayload | null> {
  const res = await fetch(bundleDataUrl("metagraph.json"));
  if (!res.ok) return null;
  return (await res.json()) as MetagraphPayload;
}

export async function loadUniverseLayout(): Promise<UniverseLayout> {
  const res = await fetch(bundleDataUrl("universe.json"));
  if (!res.ok) {
    throw new Error(`universe.json: HTTP ${res.status}`);
  }
  return (await res.json()) as UniverseLayout;
}

export async function loadSearchLandmarks(): Promise<SearchLandmarksPayload["landmarks"]> {
  const res = await fetch(bundleDataUrl("search_landmarks.json"));
  if (!res.ok) {
    return [];
  }
  const payload = (await res.json()) as SearchLandmarksPayload;
  return payload.landmarks ?? [];
}

export async function loadCommunitiesJson(): Promise<{ communities: { id: number; label: string; color: string }[] }> {
  const res = await fetch(bundleDataUrl("communities.json"));
  if (!res.ok) {
    throw new Error(`communities.json: HTTP ${res.status}`);
  }
  return (await res.json()) as { communities: { id: number; label: string; color: string }[] };
}
