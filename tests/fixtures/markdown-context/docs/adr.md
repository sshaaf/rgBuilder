# Architecture decisions

Index of architecture decision records for the markdown-context example shop.

| ADR | Topic |
|-----|--------|
| This file | Payments, platform overview |
| User guide | [Checkout Flow](./guide.md#checkout-flow) |

## Payments

**Status:** Accepted  
**Context:** Checkout must support card tokens without storing PANs.

We use a hosted fields integration and tokenize before calling
`CheckoutService.checkout()`. See the [checkout guide](./guide.md) for the user-facing flow.

### Alternatives considered

- Direct PAN storage — rejected (compliance).
- Invoice-only checkout — out of scope for v1.

## Overview

General platform notes for this fixture:

- Single-region deployment in the example corpus.
- Docs and code are indexed together when `discover -l markdown,java` runs.
