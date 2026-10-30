/**
 * A Stripe subscription in the shape the Billing page needs, as pure
 * functions over data.
 *
 * Nothing here is stored: renewal state belongs to Stripe, and a copy of it
 * would go stale the moment somebody changes a card in its dashboard.
 */
import type Stripe from 'stripe';
import type { BillingPeriod } from './pricing';

export interface CardOnFile {
  brand: string;
  last4: string;
}

export interface PaidSubscriptionView {
  /** Which price they are on, read from the item's interval. */
  plan: BillingPeriod;
  /** Stripe's own status, verbatim. */
  status: string;
  /** True once auto-renew is off: access runs to `currentPeriodEnd`, then stops. */
  cancelAtPeriodEnd: boolean;
  /** ISO. What a cancellation runs until, and when a renewal falls. */
  currentPeriodEnd: string | null;
  /** The item quantity — the seats actually paid for. */
  seatsPaid: number;
  /** ISO, when they first subscribed. */
  subscribedAt: string | null;
  card: CardOnFile | null;
  /** True while Stripe is retrying a failed renewal. */
  paymentFailed: boolean;
  /**
   * Over for good. Stripe's `canceled` is terminal — it cannot be revived,
   * only replaced by a new subscription — and `incomplete_expired` is one
   * whose first payment never completed. Either way there is no renewal to
   * promise, no cycle to switch and no auto-renew to turn back on, so the
   * card says when it ended and offers to subscribe again.
   */
  isEnded: boolean;
}

/** `month` → monthly, `year` → annual. Anything else is not a plan we sell. */
export function planFromInterval(
  interval: string | undefined,
): BillingPeriod | null {
  if (interval === 'year') return 'annual';
  if (interval === 'month') return 'monthly';
  return null;
}

/**
 * Stripe statuses that mean a renewal has failed and is being retried.
 * `unpaid` is included: retries are over and it still has not been paid,
 * which is the same message to the person holding the card.
 */
const PAYMENT_FAILING = new Set(['past_due', 'unpaid', 'incomplete']);

export function isPaymentFailing(status: string): boolean {
  return PAYMENT_FAILING.has(status);
}

/**
 * Statuses there is no way back from. Checked *before* a failing payment,
 * because a subscription cancelled after dunning is both and "ended" is the
 * more useful thing to say — there is no card to update any more.
 */
const ENDED = new Set(['canceled', 'incomplete_expired']);

export function isEnded(status: string): boolean {
  return ENDED.has(status);
}

/** Brand and last four off whichever payment method is actually charged. */
export function cardFrom(
  paymentMethod: string | Stripe.PaymentMethod | null | undefined,
): CardOnFile | null {
  if (!paymentMethod || typeof paymentMethod === 'string') return null;
  const card = paymentMethod.card;
  if (!card) return null;
  return { brand: card.brand, last4: card.last4 };
}

/** Off the item: Stripe moved it there, and reading the subscription
 * silently yields "no renewal date". See `currentPeriodEndOf`. */
export function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');
  return ends?.length ? new Date(Math.max(...ends) * 1000) : null;
}

export function subscriptionView(
  subscription: Stripe.Subscription,
): PaidSubscriptionView | null {
  const item = subscription.items?.data?.[0];
  const plan = planFromInterval(item?.price?.recurring?.interval);
  if (!item || !plan) return null;

  const periodEnd = periodEndOf(subscription);

  return {
    plan,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
    // A subscription with no quantity is one seat, which is how Stripe
    // treats a missing quantity on a licensed price.
    seatsPaid: item.quantity ?? 1,
    subscribedAt: subscription.start_date
      ? new Date(subscription.start_date * 1000).toISOString()
      : null,
    card: cardFrom(subscription.default_payment_method),
    isEnded: isEnded(subscription.status),
    // An ended subscription is not a failing one: there is nothing left to
    // retry, so "update your card" would be advice about nothing.
    paymentFailed:
      !isEnded(subscription.status) && isPaymentFailing(subscription.status),
  };
}
