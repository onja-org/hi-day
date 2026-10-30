import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Stripe.js, loaded once per tab.
 *
 * The publishable key is public by design — it ships inside this bundle and
 * identifies the account to Stripe without authorising anything — which is
 * why it is the one Stripe key allowed a `NEXT_PUBLIC_` prefix. The secret
 * key stays on the backend and never appears here.
 *
 * Resolves to null when no key is configured, which is a real state rather
 * than a fault: a self-hosted install has no Stripe account, and the modal
 * falls back to Stripe's hosted page instead of showing a form that cannot
 * take a card.
 */
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

/** Whether this build can draw the in-app modal at all. */
export function hasStripeKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
