/**
 * What the Organisation's Subscription is currently doing. Only `trialing`
 * exists today: the provider-driven values (active, past_due, canceled…)
 * arrive with the payment integration, which is what makes this a status
 * rather than a boolean.
 *
 * Note that an *expired* trial is deliberately not a value here — whether a
 * trial has run out is derived from `trialEndsAt`, so it stays correct even
 * if a scheduled job is down. See CONTEXT.md's Trial entry.
 */
export enum SubscriptionStatus {
  TRIALING = 'trialing',
}
