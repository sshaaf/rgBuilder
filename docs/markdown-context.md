# Markdown context graph

rgBuilder indexes `.md` and `.mdx` through the **custom markup plugin** `rgbuilder-lang-markdown` (not Tier 1, not generic Tier 2). It uses official `tree-sitter-md` (block + inline grammars) to build a documentation context graph alongside code.

## Discover

Markdown is registered in `default_registry()` — `discover` indexes `.md` / `.mdx` by default (same as other built-in languages). Filter with `-l markdown` when you only want docs:

```bash
export REPO=/path/to/repo
rg-build -r "$REPO" discover . -l markdown
rg-build -r "$REPO" discover . -l markdown,java   # doc + code (Phase 2b)
```

Fixture corpus: `tests/fixtures/markdown-context/` — start with its [README.md](../tests/fixtures/markdown-context/README.md) for layout, narrative, and copy-paste commands.

Automated integration gate: `cargo test --test markdown_context_cli` (CLI discover + GQL) and `cargo test -p rgbuilder-extraction markdown_spec_coverage` (in-memory spec matrix).

## Cold profile (kubernetes/website)

Large real-world markdown corpus: [kubernetes/website `content/en`](https://github.com/kubernetes/website/tree/main/content/en). Same **cold profile** pattern as `example/linux` — gitignored local checkout, deletes `.rgbuilder/` before discover, release `rg-build` only.

**Agent prompt (suggested):**

> Run **cold profile** on markdown: `cargo build --release --bin rg-build`, `./scripts/fetch-k8s-website-example.sh`, then `cargo test --release --test cold_profile_gates k8s_website_markdown_cold_discover_within_baseline -- --ignored --nocapture`. Report `[profile] discover summary` wall_secs, nodes, functions, and `index_graph_build` vs baseline 3s (+10%). Compare to last known good on this machine. Do not use an existing `.rgbuilder/` cache.

```bash
./scripts/fetch-k8s-website-example.sh
cargo build --release --bin rg-build
cargo test --release --test cold_profile_gates k8s_website_markdown_cold_discover_within_baseline -- --ignored --nocapture
```

- Discover root: `example/k8s-website` (override with `RGBUILDER_K8S_WEBSITE_REPO`)
- Command: cold `discover . -l markdown -v` (markdown plugin only; no CFG)
- Baseline: **3.0s** profile wall_secs (+10% tolerance); override with `RGBUILDER_K8S_WEBSITE_DISCOVER_BASELINE_SECS` after you establish a number on your machine
- Correctness: ≥500 heading modules, zero `:Function` nodes

See [example/README.md](../example/README.md) for other large local corpora.

## Node model

| Source | GQL label | `kind` property | Notes |
|--------|-----------|-----------------|-------|
| ATX/setext headings | `:Module` | `heading` | Filter `n.kind = 'heading'` — do not use bare `:Module` |
| Markdown links | `:Import` | `markdown_link` | Every link is a node (node inflation on link-heavy docs) |
| Fenced/indented code | `:Module` | `code_block` | `language` property from info string |
| Frontmatter keys | `:Variable` | `frontmatter` | Flattened dotted keys (`metadata.author`); `value` holds scalar text |

Qualified names: `{file_path}#{slug}` (ASCII slugify; duplicates get `-2`, `-3`, …).

### Content payloads (v1)

Agents can read section prose from the graph instead of opening files:

| Property | On | Meaning |
|----------|-----|---------|
| `body_text` | `:Module` (`heading`, `code_block`), `:Variable` (`frontmatter`) | Inline UTF-8 payload when ≤ 32 KiB |
| `body_hash` | same | Blake3 hex digest of full body (even when truncated inline) |
| `body_truncated` | same | `"true"` when body exceeds 32 KiB inline cap |
| `value` | `:Variable` (`frontmatter`) | Scalar frontmatter value as string |

**Heading sections:** `body_text` is prose from the heading through the next heading (any level), excluding nested headings. `end_line` on the node spans that same range so `code_hash` / code index align.

**Code fences:** `body_text` is fence inner content (not delimiter lines).

Large corpora: bodies beyond the inline cap still get `body_hash`; full text remains in the code index when discover stores symbol bodies. A separate `content_store.bin` blob export is not implemented yet.

Example:

```bash
rg-build -f json gql \
  "MATCH (n:Module) WHERE n.kind = 'heading' AND n.name LIKE 'Checkout*' RETURN n.body_text LIMIT 1"
```

## Author linking guide

**File links** (no `#`): href resolves relative to the markdown file’s directory. Graph edge `REFERENCES` targets the **File** node (`to_type_hint = file`). If the file is not in the discover set, the edge is **dropped** (no Class stub).

**Heading links** (`#fragment`): fragment is **literal** (never slugified). Target is a `:Module` with `kind=heading` or a Module stub if the heading does not exist.

| Author writes | Resolves to | Good? |
|---------------|-------------|-------|
| `./adr.md` | File `docs/adr.md` | Yes (file link) |
| `./adr.md#payments` | Module `docs/adr.md#payments` | Yes (literal fragment) |
| `#checkout-flow` | Same-file heading slug | Yes |
| `#Checkout Flow` | Module stub (fragment not slugified) | Avoid — use slug |
| `../src/Foo.java` | File node ending in `Foo.java` | Yes (code link) |
| `https://…` | No edge | External — ignored |

## GQL queries (Phase 2)

`LIKE` uses prefix/suffix glob only (`Checkout*`, `*adr.md`). No infix `*Checkout*`.

**Phase 2a** (`-l markdown`):

1. `MATCH (n:Module) WHERE n.kind = 'heading' AND n.name LIKE 'Checkout*' RETURN n`
2. `MATCH (a:Module)-[:CONTAINS]->(b:Module) WHERE a.kind = 'heading' AND b.kind = 'heading' RETURN a, b`
3. `MATCH (h:Module)-[:REFERENCES]->(f:File) WHERE h.kind = 'heading' AND f.name LIKE '*adr.md' RETURN h, f`
4. `MATCH (h:Module)-[:REFERENCES]->(t:Module) WHERE h.kind = 'heading' AND h.name LIKE 'Checkout*' AND t.kind = 'heading' RETURN h, t`
5. `MATCH (h:Module)-[:CONTAINS*1..3]->(n:Module) WHERE h.kind = 'heading' AND h.name LIKE 'Checkout*' AND n.kind = 'heading' RETURN h, n`

**Phase 2b** (`-l markdown,java`):

6. `MATCH (h:Module)-[:REFERENCES]->(f:File)-[:CONTAINS]->(c:Class) WHERE h.kind = 'heading' AND h.name LIKE 'Checkout*' AND f.name LIKE '*CheckoutService.java' RETURN h, f, c`

Query 6 finds doc → Java **file → class** via existing `REFERENCES` and `CONTAINS`. It does **not** include `Calls`, method-level symbols, or `blast-radius` into markdown.

## Other properties

- `WHERE n.file_path = 'docs/guide.md'` — GQL resolves `file_path` from the node (not only the properties map).
- **Concept blast** for docs: use GQL `CONTAINS` / `REFERENCES` (queries 4–6). `blast-radius` CLI remains **Calls-only**.

## PageRank and communities

Doc `REFERENCES` edges participate in discover-time centrality ([`default_behavioral_edges`](../../crates/rgbuilder-analysis/src/centrality.rs)) and community detection (`default_community_edge_types` includes `References`). The dashboard metagraph buckets `:Module` (doc headings) and `:File` nodes by directory and draws meta-edges on `references` (plus `calls` / `uses` when code is present).

`rg-build -f json metrics` uses the same behavioral edge set for PageRank and betweenness, so markdown-only corpora are not empty.

For navigation, heading `CONTAINS` trees and targeted GQL are still usually clearer than global PageRank on mixed code+doc graphs.

## `.mdx`

Registered under language id `markdown` (extensions `md` + `mdx`). MDX/JSX in code fences is not executed; only tree-sitter-md structure is indexed.

## Semantic search

`semantic index` embeds **`:Function` nodes only**. Doc headings (`:Module` with `kind=heading`) are **not** indexed. Use GQL for doc navigation; use `semantic query` for code functions after `discover` includes your language plugins.

## CFG, PDG, slice, inspect, CPG flows

Markdown has **no CFG grammar**. `discover --with-cfg` skips `.md` / `.mdx` files in the CFG batch. Commands that need a function CFG (`slice`, `inspect`, `cpg flows`) **reject** markup paths with an error pointing here.

## Dashboard

The graph view defaults to **Function + Class**. Enable **Module (incl. doc headings)** in the sidebar filter, or click **Code + doc headings**, to see documentation nodes after drill-down. Search tab remains function-only (semantic API).

## Demo video

Record a short CLI walkthrough: `docs/videos/record-markdown-context-cli.sh` (VHS tape: `docs/videos/markdown-context-cli.tape`).
