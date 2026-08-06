# Agent recipes

Copy-paste workflows for LLM agents and automation. All commands assume:

```bash
export REPO=/path/to/repo   # contains .rgbuilder/ after discover
```

**JSON shapes:** [json-api.md](json-api.md) · **Field tables:** [cli-output-schemas.md](cli-output-schemas.md)

> **jq field contract:** use the exact field names from [cli-output-schemas.md](cli-output-schemas.md) (e.g. `direct_callers_count`, not `direct_caller_count`). Smoke-test recipes after schema bumps.

---

## Recipe 1 — Orient in an unfamiliar repo

```bash
rgbuilder -r "$REPO" discover .
rgbuilder -r "$REPO" -f json discover . | jq '.metrics'
rgbuilder -r "$REPO" -f json gql --macro-name all_functions unused | jq '.count'
rgbuilder -r "$REPO" -f json gql --macro-name all_communities unused | jq '.rows[:5]'
rgbuilder -r "$REPO" -f json metrics --pagerank | jq '.rows[:10]'
```

**Use when:** first turn on a codebase; replaces reading directory trees.

---

## Recipe 1b — Named communities

```bash
rgbuilder -r "$REPO" communities list
rgbuilder -r "$REPO" -f json gql 'MATCH (c:Community) RETURN c' | jq '.rows[:10]'
# members of community 12 (id from list / communities.json):
rgbuilder -r "$REPO" -f json gql "MATCH (f:Function) WHERE f.community_id = '12' RETURN f LIMIT 20"
# optional: refresh heuristic labels into analysis_results.bin
rgbuilder -r "$REPO" communities label --write
```

**Use when:** mapping subsystems without reading `communities.json` by hand. Labels are heuristic (package / path / token); they are **not** written into the topology graph.

## Recipe 2 — Before editing a symbol

```bash
SYMBOL=ShoppingCartService
rgbuilder -r "$REPO" -f json blast-radius "$SYMBOL" | jq '{
  score: .metrics.score,
  direct_callers: .metrics.direct_callers_count,
  impact_zone: .metrics.impact_zone_size
}'
rgbuilder -r "$REPO" -f json blast-radius "$SYMBOL" --depth 3 | jq '.topology.direct_callers[:10]'
```

If the name is ambiguous, disambiguate:

```bash
rgbuilder -r "$REPO" blast-radius process --class ShoppingCartService
```

**Use when:** agent plans a refactor or bugfix; avoids missing upstream callers.

---

## Recipe 3 — Find entrypoints / APIs

```bash
rgbuilder -r "$REPO" -f json gql \
  "MATCH (n:Function) WHERE n.name LIKE '*Endpoint' RETURN n LIMIT 20" \
  | jq '.rows[].n.name'
```

**Use when:** tracing HTTP handlers or CLI entrypoints.

---

## Recipe 3b — Natural-language function discovery

```bash
rgbuilder -r "$REPO" semantic index
# Offline / no ONNX: add --embedder vocab   (or --embedder hash)
rgbuilder -r "$REPO" -f json semantic query "shopping cart checkout" --limit 10 \
  | jq '.hits[] | {name, file_path, score: .fused_score}'
# Fusion is on by default; add --keyword-and to require every query token to match
rgbuilder -r "$REPO" -f json semantic query "OrderService validate" --keyword-and \
  | jq '.hits[:5]'
```

**Use when:** the agent knows intent but not exact symbol names; complements GQL `LIKE` patterns.

---

## Recipe 4 — Call chain neighborhood

```bash
rgbuilder -r "$REPO" -f json gql \
  "MATCH (a:Function)-[:CALLS*1..3]->(b:Function) RETURN a,b LIMIT 50"
```

**Use when:** understanding feature locality without opening every file.

---

## Recipe 5 — Data-flow check at a line (needs `discover --with-cfg`)

```bash
rgbuilder -r "$REPO" discover . --with-cfg
rgbuilder -r "$REPO" -f json slice \
  src/main/java/com/example/Service.java \
  --line 42 --variable request --function handleRequest \
  | jq '.lines'
```

Note: `--function` is the **method name**, not the class name.

**Use when:** verifying what affects a variable before changing logic.

---

## Recipe 6 — Taint sanity check

```bash
rgbuilder -r "$REPO" discover . --with-cfg
rgbuilder -r "$REPO" -f json slice src/.../Controller.java \
  --line 30 --variable param --function handle --taint | jq '.flows'
```

**Use when:** security-sensitive edits (user input → sink).

---

## Recipe 7 — Migration batch planning

```bash
rgbuilder discover . --with-cfg --with-security --with-taint --with-dashboard --with-harmonic --export-migration-hints
# Prefer root plan from --export-migration-hints; dashboard copy exists when --with-dashboard ran
jq '.packages[:10]' "$REPO/.rgbuilder/migration_plan.json"
rgbuilder serve --open   # Migration tab for interactive tuning
```

**Use when:** monolith extraction ordering for humans or agents.

---

## Recipe 8 — CI policy on a branch

```bash
cp docs/examples/policy-strict.json policy.json
rgbuilder -r "$REPO" -f json check --policy-file policy.json
# exit 1 → violations in .violations[]
```

**Use when:** blocking PRs that touch high-impact symbols.

---

## Recipe 9 — HTTP session (many queries)

```bash
rgbuilder -r "$REPO" serve &
curl -sS -X POST http://127.0.0.1:8080/api/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"MATCH (n:Function) RETURN n LIMIT 5"}' | jq '.count'
```

See [http-api.md](http-api.md).

---

## Recipe 10 — Export subgraph for external tools

```bash
# Filter syntax (not GQL MATCH):
rgbuilder -r "$REPO" export --export-format graphml \
  --export-output service.graphml --query "name:ShoppingCartService"
rgbuilder -r "$REPO" export --export-format mermaid \
  --export-output all-calls.mmd --query all
```

**Use when:** handing a neighborhood to GraphML/Gephi or docs.

---

## Recipe 11 — DTO / cart mutation safety (hybrid CPG)

```bash
rgbuilder -r "$REPO" discover . --with-cfg
# Optional fidelity: --with-dfg-loops  --with-ast-skeleton

# CoolStore ShoppingCart (ecommerce-* fixtures) — non-constructor field writes:
rgbuilder -r "$REPO" -f json cpg mutations --type ShoppingCart --exclude-ctors

# Same pattern for a DTO / record candidate (substitute your type name):
# rgbuilder -r "$REPO" -f json cpg mutations --type OrderDTO --exclude-ctors

# After picking a hit at file:line, forward flows on the receiver:
rgbuilder -r "$REPO" -f json cpg flows \
  src/main/java/com/example/ecommerce/coolstore/service/ShoppingCartService.java \
  --line 75 --variable sc --function priceShoppingCart --direction forward --with-alias

# Optional: coarse syntax tree for the function
rgbuilder -r "$REPO" -f json cpg ast priceShoppingCart

# Optional: export L_repo (+ L_proc if archived) for Joern/Neo4j tooling
rgbuilder -r "$REPO" cpg export --format graphson --output cart-cpg.json --path-contains coolstore/
```

**Use when:** proving immutability before converting a mutable cart/DTO to a `record`, or locating pricing side effects on `ShoppingCart`. Empty mutations ⇒ no typed non-ctor field writes found (unresolved receivers excluded unless `--include-unresolved`). On C fixtures use the struct typedef (`shopping_cart_t`). Requires `--with-cfg`. `--with-alias` expands may-alias names (copies + field bases). See [User Guide §10](user-guide.md#10-hybrid-cpg-cpg) and [hybrid-cpg-plan.md](design/hybrid-cpg-plan.md).

---

## See also

- [AGENTS.md](../AGENTS.md)
- [User Guide](user-guide.md)
