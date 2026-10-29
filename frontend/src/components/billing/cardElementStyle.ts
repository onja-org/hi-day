import type { StripeCardNumberElementOptions } from "@stripe/stripe-js";

/**
 * The inside of the card fields.
 *
 * Individual card Elements predate the Appearance API and are explicitly
 * outside it — Stripe's own docs say so: *"The Elements Appearance API
 * doesn't support individual payment method Elements (such as CardElement).
 * Use the Style object instead."* These few properties are therefore all
 * there is, which is why an Appearance object was deleted rather than kept
 * alongside: it would have looked like it was doing something.
 *
 * Only the text inside the iframe is ours to set. The border, background,
 * radius and focus ring belong to the `<div>` we wrap each one in, which is
 * why they are ordinary Tailwind classes over in the form and only colour,
 * size and placeholder live here.
 */
const INK = "#121117";
const PLACEHOLDER = "#9795a0";
const ERROR = "#dc2626";

export const cardElementStyle: StripeCardNumberElementOptions["style"] = {
  base: {
    color: INK,
    // 16px floor: below it iOS Safari zooms the page on focus, which inside
    // a modal looks like the dialog jumping.
    fontSize: "16px",
    fontWeight: "500",
    fontFamily:
      '"Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSmoothing: "antialiased",
    iconColor: INK,
    "::placeholder": { color: PLACEHOLDER },
  },
  invalid: {
    color: INK,
    iconColor: ERROR,
  },
};
