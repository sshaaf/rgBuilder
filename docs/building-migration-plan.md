# Building a migration plan

CLI-oriented how-to. Scoring/ordering math: [migration-algorithms.md](migration-algorithms.md) · [design/migration-planner-design.md](design/migration-planner-design.md).

## Phase 1 — Inventory

```bash
rg-build discover . --with-cfg --with-security --with-taint --with-harmonic --export-migration-hints
rg-build -f json gql --macro-name all_functions unused | jq '.count'
rg-build -f json gql --macro-name all_communities unused | jq '.count'
```

Read `.rgbuilder/migration_plan.json`. Optional UI: add `--with-universe` and `rg-build serve --open` ([dashboard user guide](dashboard-user-guide.md)).

## Phase 2 — Hotspots

```bash
rg-build -f json metrics --pagerank --betweenness --communities
```

Low PageRank/betweenness → earlier migration candidates; high → core bridges. Communities (label propagation) suggest batch boundaries.

## Phase 3 — Blast radius

```bash
rg-build -f json blast-radius <Symbol> --depth 2
```

Use impact zone + score; deepen with `--depth` for wrappers/adapters. Prefer `-f json` for durable UUIDs/names.

## Phase 4 — Extract carefully

- `slice` / `slice --taint` for statement-level and security flows ([User Guide §8](user-guide.md#8-program-slicing-and-taint)).
- `export --export-format mermaid|graphviz|…` for review subgraphs.

## Phase 5 — CI guardrails

Write a [policy file](policy-format.md) and run `rg-build -f json check --policy-file policy.json` in PRs (exit `1` on violations).

## Artifacts

| Path | When |
|------|------|
| `.rgbuilder/migration_plan.json` | `--export-migration-hints` |
| `.rgbuilder/universe/migration_*.json` | also `--with-universe` |
