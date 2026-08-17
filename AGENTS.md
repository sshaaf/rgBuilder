# rgBuilder for AI agents

rgBuilder is designed so agents answer **structural questions** from a pre-built graph instead of reading whole files into context.

**Full JSON reference:** [docs/json-api.md](docs/json-api.md) (also on the site: [sshaaf.github.io/rgBuilder/docs/json-api/](https://sshaaf.github.io/rgBuilder/docs/json-api/))  
**Copy-paste recipes:** [docs/agent-recipes.md](docs/agent-recipes.md)  
**Human walkthrough:** [docs/user-guide.md](docs/user-guide.md)  
**Docs hub:** [docs/README.md](docs/README.md) · [site docs](https://sshaaf.github.io/rgBuilder/docs/)

Do **not** open the browser dashboard unless the user asks for a visual UI — default to CLI `-f json`.

---

## Agent workflow

```text
1. rg-build discover .              # once per repo (or after large changes)
2. rg-build -f json <command>      # compact facts on stdout
3. Parse schema_version + payload   # never scrape stderr for JSON
```

Set `REPO` to the repository root (where `.rgbuilder/` lives):

```bash
export REPO=/path/to/repo
rg-build -r "$REPO" -f json gql 'MATCH (n:Function) RETURN n LIMIT 20'
```

---

## High-value commands (low token cost)

| Intent | Command |
|--------|---------|
| Inventory functions | `rg-build -f json gql --macro-name all_functions unused` |
| List communities | `rg-build -f json gql --macro-name all_communities unused` |
| Find symbol by pattern | `rg-build -f json gql "MATCH (n:Function) WHERE n.name LIKE '*Service*' RETURN n LIMIT 20"` |
| Find by FQN (not `n.name`) | `rg-build -f json gql "MATCH (n:Class) WHERE n.qualified_name = 'com.example.Foo' RETURN n"` |
| Community members | `rg-build -f json gql "MATCH (f:Function) WHERE f.community_id = '12' RETURN f LIMIT 20"` |
| Natural-language function search | `rg-build semantic index` (or `--embedder vocab`) then `rg-build -f json semantic query "checkout flow" --limit 10` |
| Community semantic search | `rg-build -f json semantic query "checkout" --scope community --limit 10` |
| Impact before editing | `rg-build -f json blast-radius <Symbol> [--depth N]` |
| Architectural hotspots | `rg-build -f json metrics --pagerank` |
| Call neighborhood | `rg-build -f json gql "MATCH (a:Function)-[:CALLS*1..3]->(b:Function) RETURN a,b LIMIT 50"` |
| Doc headings / cross-links | `discover` indexes `.md` / `.mdx` by default; GQL on `:Module` with `kind=heading` and `REFERENCES` — see [markdown-context.md](docs/markdown-context.md) |
| Hybrid CPG status / CALL / PDG / slice | `rg-build -f json cpg status` then `cpg function\|calls\|pdg\|slice` (needs `discover --with-cfg` for PDG/slice) |
| Field mutations (cart / DTO safety) | `rg-build -f json cpg mutations --type ShoppingCart --exclude-ctors` (ecommerce CoolStore; or any type name; needs `--with-cfg`) |
| Data flows / slice (CPG) | `rg-build -f json cpg flows FILE --line N --variable V --function F [--direction forward\|backward] [--with-alias]` |
| Loop-carried DFG tags | `rg-build discover . --with-cfg --with-dfg-loops` (tags `DataDependency.loop_carried` in PDG) |
| AST skeleton | `rg-build discover --with-ast-skeleton` then `rg-build -f json cpg ast <Symbol>` |
| CPG export | `rg-build cpg export --format graphson --output cpg.json [--path-contains src/]` |
| Migration plan | `rg-build discover . --with-cfg --with-security --with-taint --with-dashboard --with-harmonic --export-migration-hints` then read `.rgbuilder/migration_plan.json` (or dashboard copy) |
| CI gate on changes | `rg-build -f json check --policy-file policy.json` (exit 1 = violations) |

---

## Repeated queries in one session

**Option A — HTTP (recommended):**

```bash
rg-build -r "$REPO" serve --open
# POST http://127.0.0.1:8080/api/query  {"query":"MATCH (n:Function) RETURN n LIMIT 5"}
```

See [docs/http-api.md](docs/http-api.md).

**Option B — Legacy socket daemon:**

```bash
rg-build -r "$REPO" serve --daemon
# blast-radius auto-connects to .rgbuilder/query.sock unless RGBUILDER_NO_QUERY_DAEMON=1
```

---

## Rules of thumb

1. **Index first** — `gql`, `blast-radius`, `metrics` fail without `discover`.
2. **Use `-f json`** — stable `schema_version` fields; see [json-api.md](docs/json-api.md).
3. **`inspect` takes a symbol only** — no `--class` (use `blast-radius` for disambiguation).
4. **`slice --function`** is the **method/function name**, not the class name.
5. **`export --query`** uses filter syntax (`name:Foo`, `type:Function`, `all`) — not full GQL `MATCH`.
6. **Deep analysis** needs `discover --with-cfg` (and `--with-taint` for discover-time taint) (slice, inspect, taint).
7. **Semantic search** needs `semantic index` (separate from discover). Default **code-daemon** needs LFS ONNX weights from source; offline use `--embedder vocab` or `--embedder hash`. Fusion is on by default (`--no-fusion` to disable).
8. **Profile discover** — `discover -v` with `RUST_LOG=profile=info` for `[profile] stage` and centrality sub-phase timings (see [analysis-architecture.md](docs/analysis-architecture.md)). Cold gates: `cargo test --release --test cold_profile_gates -- --ignored` (linux / metasfresh / kafka). Markdown stress: `./scripts/fetch-k8s-website-example.sh` then `cargo test --release --test markdown_stress_gates -- --ignored`.
9. **Dashboard is optional** — only with `--with-dashboard` / `serve` when a human wants a UI; never required for structural answers.
10. **Markdown docs** — `.md` / `.mdx` are indexed on `discover` (headings, links, frontmatter). Use GQL for doc navigation; semantic index is functions-only; `slice` / `inspect` / `cpg flows` reject markup paths. See [markdown-context.md](docs/markdown-context.md).
---

## On-disk artifacts for agents

After `discover`:

| Path | Content |
|------|---------|
| `.rgbuilder/graph.snapshot.bin` | Graph snapshot |
| `.rgbuilder/dashboard/manifest.json` | Counts, feature flags |
| `.rgbuilder/dashboard/migration_plan.json` | Migration export (with `--with-dashboard` and/or `--export-migration-hints`) |
| `.rgbuilder/dashboard/graph_payload.bin` | Columnar graph for dashboard WASM |
| `.rgbuilder/semantic_index.bin` | Opt-in semantic search index (`semantic index`) |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Policy violation (`check`, `blast-radius --policy-file`) or command error |

---

## See also

- [Introduction](docs/Introduction.md) — concepts
- [User Guide](docs/user-guide.md) — full CLI
- [Markdown context graph](docs/markdown-context.md) — `.md` / `.mdx` indexing and GQL
- [Further reading](docs/further-reading.md) — research map and contribution ideas
