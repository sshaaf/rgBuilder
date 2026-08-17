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

## Node model

| Source | GQL label | `kind` property | Notes |
|--------|-----------|-----------------|-------|
| ATX/setext headings | `:Module` | `heading` | Filter `n.kind = 'heading'` — do not use bare `:Module` |
| Markdown links | `:Import` | `markdown_link` | Every link is a node (node inflation on link-heavy docs) |
| Fenced/indented code | `:Module` | `code_block` | `language` property from info string |
| Frontmatter keys | `:Variable` | `frontmatter` | Flattened dotted keys (`metadata.author`) |

Qualified names: `{file_path}#{slug}` (ASCII slugify; duplicates get `-2`, `-3`, …).

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

## PageRank honesty

Doc `REFERENCES` edges participate in the graph like other edges, but markdown-only navigation is usually better served by heading `CONTAINS` trees and targeted GQL than by global PageRank on mixed code+doc graphs.

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
