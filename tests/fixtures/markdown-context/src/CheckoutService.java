package checkout;

/**
 * Server-side checkout orchestration for the markdown-context example.
 * Linked from docs/guide.md — use GQL query 6 to traverse doc → file → class.
 */
public class CheckoutService {

    /**
     * Runs validate → pay → confirm. Documented in docs/guide.md#checkout-flow.
     */
    public void checkout() {
        validateCart();
        capturePayment();
        confirmOrder();
    }

    private void validateCart() {
        // Cart rules: docs/guide.md#cart
    }

    private void capturePayment() {
        // See docs/adr.md#payments
    }

    private void confirmOrder() {
        // Post-payment side effects
    }
}
