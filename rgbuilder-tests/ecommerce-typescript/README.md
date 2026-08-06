# ecommerce-typescript

E-commerce reference app.

## rgBuilder

See [summary report](../rgbuilder-reports/REPORT.md) · [language report](../rgbuilder-reports/languages/typescript.md) · [HTML](../rgbuilder-reports/languages/typescript.html) (2026-07-22).

```bash
rg-build -f json discover . --cfg -e node_modules,dist
rg-build -f json blast-radius 'src/services/orderService.ts::checkout'
rg-build -f json metrics --communities --pagerank
rg-build -f json check --policy-file ../rgbuilder-policy.json
```

| Metric | Value |
|--------|------:|
| Files indexed | 61 |
| Nodes | 1607 |
| Edges | 3169 |
| Discover ms | 305 |
| Cache MB | 1.88 |

| Feature | Status |
|---------|:------:|
| discover | ✓ |
| blast-radius | ✓ |
| metrics | ✓ |
| export | ✗ |
| check | ✓ |
| slice / taint | — / ✓ |

### Top symbols

| Symbol | Score | Callers | Impact |
|--------|------:|--------:|-------:|
| `getDb` | 40.80 | 16 | 16 |
| `asyncHandler` | 40.45 | 9 | 9 |
| `nowIso` | 40.35 | 6 | 7 |
| `createShoppingCartItem` | 40.10 | 2 | 2 |
| `migrate` | 25.10 | 1 | 2 |

High AST node count; compare with JavaScript sibling.

Raw: [`../rgbuilder-reports/typescript-summary.json`](../rgbuilder-reports/typescript-summary.json)
