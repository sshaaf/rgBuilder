---
qualified_name: "/Users/sraghuna/local_dev/petprojects/rBuilder/tests/fixtures/markdown-context/./README.md#what-gets-indexed"
level: "2"
---

| File | Graph content |
|------|----------------|
| Headings (`#`, `##`) | `:Module` nodes, `kind=heading`, QN `{path}#{slug}` |
| Internal `[links](...)` | `:Import` link nodes + `REFERENCES` edges |
| Fenced code blocks | `:Module`, `kind=code_block` |
| YAML frontmatter (this README) | `:Variable`, flattened keys (`metadata.author`) |
| `.java` (with `-l java`) | Classes/methods; `CONTAINS` from file nodes |
