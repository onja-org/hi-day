import type Stripe from 'stripe';

/**
 * Stripe subscription statuses that are finished for good: the
 * subscription can never charge again. `incomplete_expired` is a first
 * payment that never completed within Stripe's 23 hours.
 *
 * Deliberately a list of the ended ones rather than of the live ones, so a
 * status Stripe adds later reads as *not* ended — the safe answer whenever
 * the question is "may we start another subscription beside this one?".
 */
const ENDED: ReadonlySet<Stripe.Subscription.Status> = new Set([
  'canceled',
  'incomplete_expired',
]);

/** Whether this subscription is finished and can never charge again. */
export function hasEnded(status: Stripe.Subscription.Status): boolean {
  return ENDED.has(status);
}
