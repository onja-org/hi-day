import type { PaidSubscription } from "@/types/subscription";

/**
 * What the subscription card offers about the next renewal:
 *
 * - `cancel` — it renews; offer to stop that.
 * - `resume` — cancelled but the paid period is still running; turning
 *   renewal back on carries on the same subscription, nothing charged now.
 * - `renew` — it has ended, but access has not: the grace days after the
 *   period end. Stripe's `canceled` is terminal, so resuming here starts a
 *   new subscription, paid for today.
 */
export type RenewalAction = "cancel" | "resume" | "renew";

/**
 * Null when there is nothing to offer: a first payment that has not gone
 * through (no renewal yet), or an ended subscription whose grace is over —
 * by then subscribing again is the Billing page's ordinary Add payment.
 *
 * `hasAccess` is the server's answer to "is the paid period plus its grace
 * days still running?", so neither the grace length nor the clock is
 * decided here.
 */
export function renewalAction(
  subscription: Pick<PaidSubscription, "status" | "isEnded" | "cancelAtPeriodEnd">,
  hasAccess: boolean,
): RenewalAction | null {
  if (subscription.isEnded) return hasAccess ? "renew" : null;
  if (subscription.status === "incomplete") return null;
  return subscription.cancelAtPeriodEnd ? "resume" : "cancel";
}
