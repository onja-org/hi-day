import type { TrialStatus } from "@/types/billing";

/**
 * Stripe statuses a new subscription may start beside — the same rule the
 * backend's checkout enforces. `incomplete` is a first payment still
 * awaited (a declined card); the other two are finished for good.
 */
const PAYABLE_AGAIN = new Set(["incomplete", "incomplete_expired", "canceled"]);

/**
 * Whether the Billing page should offer to take a card. Read off Stripe's
 * status rather than `isPaid`, which stays true for good once anything was
 * ever paid — that hid the way back from every customer who cancelled.
 * Anything else, including a status Stripe adds later, is treated as a
 * subscription that can still charge, so paying again is not offered.
 */
export function canStartSubscription(trial: TrialStatus | null | undefined): boolean {
  if (!trial?.stripeStatus) return !trial?.isPaid;
  return PAYABLE_AGAIN.has(trial.stripeStatus);
}
