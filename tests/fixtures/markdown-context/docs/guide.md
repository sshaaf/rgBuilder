# Checkout Flow

End-to-end checkout: cart review, payment capture, and order confirmation. This guide is the **entry doc** for the example corpus.

Primary references:

- [payments ADR](./adr.md#payments) — card token decision
- [ADR index](./adr.md) — full architecture record file
- [CheckoutService API](../src/CheckoutService.java) — server implementation

## Related material

The links above are indexed as `REFERENCES` from this **Checkout Flow** heading (not from child sections).

## Cart

The cart step validates line items, applies promotions, and computes totals before payment.

### Validation rules

- Quantity must be positive.
- SKU must exist in the catalog snapshot.

```java
// Illustrative — real logic lives in CheckoutService
cart.validate();
```

See also the [overview section](./adr.md#overview) for platform constraints.

## Payment handoff

After the cart step, the flow delegates to the payment provider described in the ADR. External docs (not indexed): [Stripe API](https://stripe.com/docs/api).
