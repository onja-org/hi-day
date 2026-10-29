/**
 * Reading "has this subscription ever been paid for" out of Stripe's own
 * status, kept free of Nest so the table of answers is readable in one place.
 */

/**
 * Stripe statuses that can only be reached by a successful payment.
 *
 * `incomplete` and `incomplete_expired` are the two that cannot: they are
 * precisely "a subscription was created and the first payment never
 * completed". Everything else — including `past_due`, `unpaid` and
 * `canceled` — is downstream of money having arrived at least once, which
 * is the question being asked here. Whether money is arriving *now* is a
 * different question, answered by `stripeStatus` itself.
 *
 * `trialing` is absent deliberately: we no longer hand Stripe a trial (see
 * `docs/adr/0031-...`), so a subscription of ours is never in it. Were one
 * to appear, treating it as unpaid is the safe reading.
 */
const NEVER_PAID = new Set(['incomplete', 'incomplete_expired', 'trialing']);

export function stripeSaysPaid(stripeStatus: string | null): boolean {
  if (!stripeStatus) return false;
  return !NEVER_PAID.has(stripeStatus);
}
