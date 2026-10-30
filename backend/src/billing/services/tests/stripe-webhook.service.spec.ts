import type Stripe from 'stripe';
import { currentPeriodEndOf } from '../stripe-webhook.service';

/** Only the fields this reads; the real object carries dozens more. */
function subscriptionWithItems(
  ends: (number | undefined)[],
): Stripe.Subscription {
  return {
    items: { data: ends.map((end) => ({ current_period_end: end })) },
  } as unknown as Stripe.Subscription;
}

describe('currentPeriodEndOf', () => {
  it('reads the period end off the item, where Stripe now puts it', () => {
    expect(currentPeriodEndOf(subscriptionWithItems([1767225600]))).toBe(
      1767225600,
    );
  });

  // The bug this exists to stop coming back: it used to be read off the
  // subscription through a cast, which compiled and returned undefined
  // forever, so every webhook wrote `currentPeriodEnd: null` and a
  // cancellation left nothing saying what had been paid for.
  it('does not read it off the subscription itself', () => {
    const legacyShape = {
      current_period_end: 1767225600,
      items: { data: [] },
    } as unknown as Stripe.Subscription;
    expect(currentPeriodEndOf(legacyShape)).toBeUndefined();
  });

  it('takes the latest where a subscription ever has several prices', () => {
    expect(
      currentPeriodEndOf(subscriptionWithItems([1767225600, 1769904000])),
    ).toBe(1769904000);
  });

  it('answers nothing rather than a wrong date when there are no items', () => {
    expect(currentPeriodEndOf(subscriptionWithItems([]))).toBeUndefined();
    expect(
      currentPeriodEndOf({} as unknown as Stripe.Subscription),
    ).toBeUndefined();
  });
});
