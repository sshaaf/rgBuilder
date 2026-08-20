import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { fetchSemanticStatus, semanticQuery } from "../semanticSearch";
import { mapSemanticHitToResult, searchLocal, type SearchResult } from "./search";
import type { SearchLandmark, UniverseCommunity, Vec3 } from "./types";

export interface FlyTarget {
  key: string;
  position: Vec3;
  communityId?: number;
  distance?: number;
}

export interface SearchBarProps {
  landmarks: SearchLandmark[];
  communities: { id: number; label: string; color: string }[];
  layoutCommunities: UniverseCommunity[];
  onFlyTo: (target: FlyTarget) => void;
  onFlyToast?: (label: string) => void;
  focusRef?: { current: (() => void) | null };
}

const KIND_LABELS: Record<SearchResult["kind"], string> = {
  community: "Community",
  landmark: "Symbol",
  semantic: "Semantic",
};

export function SearchBar({
  landmarks,
  communities,
  layoutCommunities,
  onFlyTo,
  onFlyToast,
  focusRef,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [semanticReady, setSemanticReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usedSemantic, setUsedSemantic] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    setOpen(true);
  }, []);

  useEffect(() => {
    if (focusRef) focusRef.current = focusSearch;
    return () => {
      if (focusRef) focusRef.current = null;
    };
  }, [focusRef, focusSearch]);

  useEffect(() => {
    void fetchSemanticStatus()
      .then((s) => setSemanticReady(s.available))
      .catch(() => setSemanticReady(false));
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setUsedSemantic(false);
        return;
      }
      const local = searchLocal(trimmed, landmarks, communities, layoutCommunities);
      if (local.length > 0) {
        setUsedSemantic(false);
        setResults(local);
        return;
      }
      if (!semanticReady) {
        setResults([]);
        setUsedSemantic(false);
        return;
      }
      setLoading(true);
      try {
        const resp = await semanticQuery(trimmed, { limit: 8, fusion: true });
        const hits = resp.hits
          .map((h) => mapSemanticHitToResult(h, landmarks, layoutCommunities))
          .filter((r): r is SearchResult => r != null);
        setUsedSemantic(true);
        setResults(hits);
      } catch {
        setResults([]);
        setUsedSemantic(false);
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
    onFlyToast?.(r.label);
    setOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open || results.length === 0 || document.activeElement !== inputRef.current) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const hit = results[activeIndex];
        if (hit) pick(hit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, focusSearch, open, results]);

  return (
    <div class="universe-search-wrap">
      <div class="universe-search glass" role="search">
        <span class="universe-search-mag" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.6" stroke="currentColor" stroke-width="1.5" />
            <path d="M10.2 10.2 13.4 13.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </span>
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
      {open && query.trim() ? (
        <ul class="universe-search-results" role="listbox">
          {usedSemantic ? (
            <li class="universe-search-semantic-hint" aria-live="polite">
              “{query.trim()}” → semantic matches
            </li>
          ) : null}
          {loading ? (
            <li class="universe-search-empty">Searching…</li>
          ) : results.length === 0 ? (
            <li class="universe-search-empty">No matches</li>
          ) : (
            results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  class={`universe-search-hit${i === activeIndex ? " active" : ""}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => pick(r)}
                >
                  <span class="universe-search-hit-row">
                    <span class="universe-search-hit-label">{r.label}</span>
                    <span class={`universe-search-kind universe-search-kind--${r.kind}`}>
                      {KIND_LABELS[r.kind]}
                    </span>
                  </span>
                  {r.sublabel ? (
                    <span class="universe-search-hit-sub">{r.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
