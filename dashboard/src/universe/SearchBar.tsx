import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { fetchSemanticStatus, semanticQuery } from "../semanticSearch";
import { mapSemanticHitToResult, searchLocal, type SearchResult } from "./search";
import type { SearchLandmark, UniverseCommunity, Vec3 } from "./types";

export interface FlyTarget {
  key: string;
  position: Vec3;
  communityId?: number;
  /** Camera distance override (L1 galaxy focus uses ~260/2.5). */
  distance?: number;
}

export interface SearchBarProps {
  landmarks: SearchLandmark[];
  communities: { id: number; label: string; color: string }[];
  layoutCommunities: UniverseCommunity[];
  onFlyTo: (target: FlyTarget) => void;
}

export function SearchBar({
  landmarks,
  communities,
  layoutCommunities,
  onFlyTo,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [semanticReady, setSemanticReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchSemanticStatus()
      .then((s) => setSemanticReady(s.available))
      .catch(() => setSemanticReady(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      const local = searchLocal(trimmed, landmarks, communities, layoutCommunities);
      if (local.length > 0) {
        setResults(local);
        return;
      }
      if (!semanticReady) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await semanticQuery(trimmed, { limit: 8, fusion: true });
        const hits = resp.hits
          .map((h) => mapSemanticHitToResult(h, landmarks, layoutCommunities))
          .filter((r): r is SearchResult => r != null);
        setResults(hits);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [landmarks, communities, layoutCommunities, semanticReady],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runSearch(query);
    }, 120);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  const pick = (r: SearchResult) => {
    onFlyTo({
      key: `${r.id}:${Date.now()}`,
      position: r.position,
      communityId: r.communityId,
    });
    setOpen(false);
  };

  return (
    <div class="universe-search-wrap">
      <div class="universe-search" role="search">
        <input
          ref={inputRef}
          type="search"
          class="universe-search-input"
          placeholder="Search functions, communities…"
          aria-label="Search functions, communities"
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <kbd class="universe-search-kbd">⌘ K</kbd>
      </div>
      {open && query.trim() && (
        <ul class="universe-search-results" role="listbox">
          {loading ? (
            <li class="universe-search-empty">Searching…</li>
          ) : results.length === 0 ? (
            <li class="universe-search-empty">No matches</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  class="universe-search-hit"
                  role="option"
                  onClick={() => pick(r)}
                >
                  <span class="universe-search-hit-label">{r.label}</span>
                  {r.sublabel ? (
                    <span class="universe-search-hit-sub">{r.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
