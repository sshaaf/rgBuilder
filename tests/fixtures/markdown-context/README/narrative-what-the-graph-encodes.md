---
qualified_name: "/Users/sraghuna/local_dev/petprojects/rBuilder/tests/fixtures/markdown-context/./README.md#narrative-what-the-graph-encodes"
level: "2"
---

1. **Checkout Flow** (`docs/guide.md`) describes the user journey and links to:
   - the **Payments** section in `docs/adr.md` (heading link),
   - the whole ADR file (file link),
   - `CheckoutService.java` (code link).
2. **Cart** is a child heading under Checkout Flow (`CONTAINS` in the graph).
3. **README frontmatter** (`metadata.*`) appears as `:Variable` nodes in the graph.
4. With Java enabled, query 6 walks: heading → file → `CheckoutService` class.

Full query catalog: [docs/markdown-context.md](../../../docs/markdown-context.md) in the main repo.
