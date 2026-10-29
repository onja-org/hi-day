/**
 * Only `trialing` exists today; Stripe's values arrive with the payment
 * integration. An *expired* trial is deliberately not a value: that is
 * derived from `trialEndsAt`, so it stays correct if a job is down.
 */
export enum SubscriptionStatus {
  TRIALING = 'trialing',
}
