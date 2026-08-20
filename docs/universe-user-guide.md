# rg Universe user guide

Full-screen 3D exploration of your repository after `discover`. This replaces the legacy tabbed dashboard.

**CLI remains the default for agents** — use `rg-build -f json` for structural answers. Universe is for human spatial exploration.

---

## Prerequisites

1. Index and export the universe bundle:

```bash
cd /path/to/your/repo
rg-build discover . --with-universe
# deep analysis (CFG, taint, migration overlays):
rg-build discover . --with-cfg --with-security --with-taint --with-universe --with-harmonic --export-migration-hints
```

2. Open over **HTTP** (required for WASM):

```bash
rg-build serve --open
# or static files only:
cd .rgbuilder/universe && python3 -m http.server 8765
```

Do **not** open `index.html` via `file://` — the graph worker cannot load `graph_payload.bin`.

---

## Layout

| Area | Description |
|------|-------------|
| **Cosmos (L0)** | Community “galaxies” and inter-community bridge lines from `universe.json` |
| **Search bar (⌘K)** | Landmarks + communities; semantic fallback when served with a semantic index |
| **Breadcrumb** | `Universe › community › package › symbol` — click to zoom out |
| **Context panel (L3)** | Blast radius, metrics, optional CFG/dataflow insets |
| **Commands (⌘)** | Copy or run whitelisted maintenance commands when served |

---

## LOD navigation

1. **L0 — Cosmos:** all communities; migration hotspots show amber rings; taint-affected communities pulse red with highlighted cross-community paths.
2. **L1 — Galaxy:** click a community to fly in; package cubes appear in local frame.
3. **L2 — Neighborhood:** click a package; WASM `expand()` loads function nodes (lazy when camera is near).
4. **L3 — Symbol:** click a function node; context panel shows blast radius and analysis insets.

---

## Search and fly-to

- Client search over `search_landmarks.json` and community labels.
- When `rg-build serve` is running and a semantic index exists, `/api/semantic/query` augments results.
- Camera eases to the target in ~800ms (`prefers-reduced-motion` uses instant jumps).

---

## Universe commands (when served)

From the **Commands** panel (⌘ button):

| Action | CLI equivalent |
|--------|----------------|
| Build search index | `rg-build semantic index` |
| Refresh discover | `rg-build discover . --with-universe …` |
| Refresh CFG archives | `rg-build discover . --with-cfg --with-universe` |

Long-running actions stream **SSE** progress from `POST /api/universe/actions`.

---

## Async architecture

| Layer | Mechanism |
|-------|-----------|
| **Export** | Parallel analysis streaming (`analysis_stream_export`); universe layout uses `rayon` over communities |
| **Boot** | Async `fetch` for manifest, `universe.json`, landmarks — no sync XHR |
| **Graph queries** | Dedicated WASM worker (`useEngineWorker`) for expand / blast / slice |
| **Layout** | L2 node positions computed in a layout helper on the main thread from WASM subgraph payloads |
| **Maintenance** | SSE subprocess actions with single-flight lock and 600s timeout |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Universe UI not found” on `serve` | Run `rg-build discover . --with-universe` |
| WASM engine error | Rebuild UI: `cd dashboard && npm run build:universe`, then re-run discover |
| Empty cosmos | Check `.rgbuilder/universe/universe.json` and `communities.json` |
| No migration rings | Need `--export-migration-hints` (and `--with-harmonic` for ranking data) |
| No taint highlights | Need `--with-taint`; vulnerable flows must map to landmark communities |
| Semantic search empty | `rg-build semantic index` then query via serve |

---

## See also

- [User guide](user-guide.md) — full CLI reference
- [AGENTS.md](../AGENTS.md) — agent workflow (`-f json` default)
- [docs/universe/](universe/) — design mockups
