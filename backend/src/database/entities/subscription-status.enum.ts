/**
 * Our own answer to "has this Organisation ever paid", which is a different
 * question from "is Stripe collecting successfully" — that one is mirrored
 * verbatim in `Subscription.stripeStatus`.
 *
 * Kept separate on purpose: one column holding both meanings is how a
 * webhook about a failed renewal silently un-pays a customer and puts them
 * back on a trial that ended months ago.
 *
 * `trialing` → `active` is one-way. An *expired* trial is deliberately not a
 * value: that is derived from `trialEndsAt`, so it stays correct even if a
 * job is down.
 */
export enum SubscriptionStatus {
  /** No payment has ever succeeded. Every Organisation starts here. */
  TRIALING = 'trialing',
  /** A payment has succeeded. The trial is over and does not come back. */
  ACTIVE = 'active',
}
