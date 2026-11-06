import type { PaidSubscription } from "@/types/subscription";

/**
 * How the Billing page's seat counter behaves:
 *
 * - `purchase` — nothing is being billed yet (a trial, an ended
 *   subscription, a first payment that never went through). The count saves
 *   as it is typed and becomes the size of the subscription when they pay.
 * - `change` — a subscription that renews. A change is previewed and
 *   confirmed, because it is charged (or credited) straight away.
 * - `locked` — paid, but set to end. Adding seats would charge the card
 *   now for a subscription that is ending, and Stripe can't even preview
 *   it; resuming the subscription is what unlocks it.
 */
export type SeatsMode = "purchase" | "change" | "locked";

export function seatsMode(
  subscription:
    | Pick<PaidSubscription, "status" | "isEnded" | "cancelAtPeriodEnd">
    | null
    | undefined,
): SeatsMode {
  if (!subscription || subscription.isEnded || subscription.status === "incomplete") {
    return "purchase";
  }
  return subscription.cancelAtPeriodEnd ? "locked" : "change";
}
