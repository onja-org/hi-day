import type Stripe from 'stripe';
import {
  cardFrom,
  isEnded,
  isPaymentFailing,
  periodEndOf,
  planFromInterval,
  subscriptionView,
} from '../subscription-view';

function subscription(
  overrides: Record<string, unknown> = {},
  itemOverrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    status: 'active',
    cancel_at_period_end: false,
    start_date: 1790000000,
    default_payment_method: {
      card: { brand: 'visa', last4: '4242' },
    },
    items: {
      data: [
        {
          id: 'si_1',
          quantity: 50,
          current_period_end: 1800000000,
          price: { recurring: { interval: 'year' } },
          ...itemOverrides,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe('planFromInterval', () => {
  it('reads the plan off the price interval', () => {
    expect(planFromInterval('year')).toBe('annual');
    expect(planFromInterval('month')).toBe('monthly');
  });

  it('refuses an interval we do not sell', () => {
    expect(planFromInterval('week')).toBeNull();
    expect(planFromInterval(undefined)).toBeNull();
  });
});

describe('isPaymentFailing', () => {
  it.each(['past_due', 'unpaid', 'incomplete'])(
    'reads %s as a failing payment',
    (status) => {
      expect(isPaymentFailing(status)).toBe(true);
    },
  );

  it.each(['active', 'canceled', 'paused'])(
    'reads %s as not failing',
    (status) => {
      expect(isPaymentFailing(status)).toBe(false);
    },
  );
});

describe('isEnded', () => {
  it.each(['canceled', 'incomplete_expired'])('reads %s as over', (status) => {
    expect(isEnded(status)).toBe(true);
  });

  it.each(['active', 'past_due', 'unpaid', 'paused'])(
    'reads %s as still going',
    (status) => {
      expect(isEnded(status)).toBe(false);
    },
  );
});

describe('cardFrom', () => {
  it('reads brand and last four off an expanded payment method', () => {
    expect(
      cardFrom({
        card: { brand: 'visa', last4: '4242' },
      } as Stripe.PaymentMethod),
    ).toEqual({ brand: 'visa', last4: '4242' });
  });

  // An unexpanded id tells us nothing, and guessing would put a wrong card
  // on the page.
  it('answers nothing for an id, a null, or a non-card method', () => {
    expect(cardFrom('pm_123')).toBeNull();
    expect(cardFrom(null)).toBeNull();
    expect(cardFrom({} as Stripe.PaymentMethod)).toBeNull();
  });
});

describe('periodEndOf', () => {
  // Stripe moved this onto the item; reading the subscription returns
  // undefined and silently produces "no renewal date".
  it('reads the period end off the item, not the subscription', () => {
    expect(periodEndOf(subscription())).toEqual(new Date(1800000000 * 1000));
    expect(
      periodEndOf({
        current_period_end: 1800000000,
        items: { data: [] },
      } as unknown as Stripe.Subscription),
    ).toBeNull();
  });
});

describe('subscriptionView', () => {
  it('reads an annual subscription', () => {
    expect(subscriptionView(subscription())).toEqual({
      plan: 'annual',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(1800000000 * 1000).toISOString(),
      seatsPaid: 50,
      subscribedAt: new Date(1790000000 * 1000).toISOString(),
      card: { brand: 'visa', last4: '4242' },
      isEnded: false,
      paymentFailed: false,
    });
  });

  describe('a subscription that is over', () => {
    it.each(['canceled', 'incomplete_expired'])(
      'reads %s as ended',
      (status) => {
        const view = subscriptionView(subscription({ status }));
        expect(view?.isEnded).toBe(true);
      },
    );

    // Both, in Stripe's reading — but there is nothing left to retry, so
    // "update your card" would be advice about nothing.
    it('does not also call a cancelled subscription a failing payment', () => {
      const view = subscriptionView(subscription({ status: 'canceled' }));
      expect(view?.paymentFailed).toBe(false);
    });
  });

  it('reads a monthly subscription', () => {
    const view = subscriptionView(
      subscription({}, { price: { recurring: { interval: 'month' } } }),
    );
    expect(view?.plan).toBe('monthly');
  });

  // Auto-renew off: access runs to the period end and then stops.
  it('reports auto-renew being off', () => {
    const view = subscriptionView(subscription({ cancel_at_period_end: true }));
    expect(view?.cancelAtPeriodEnd).toBe(true);
  });

  it('reports a failing renewal', () => {
    const view = subscriptionView(subscription({ status: 'past_due' }));
    expect(view?.paymentFailed).toBe(true);
  });

  // Stripe treats a missing quantity on a licensed price as one.
  it('reads a missing quantity as one seat', () => {
    const view = subscriptionView(subscription({}, { quantity: undefined }));
    expect(view?.seatsPaid).toBe(1);
  });

  it('answers nothing for a subscription on no plan we sell', () => {
    expect(
      subscriptionView(
        subscription({}, { price: { recurring: { interval: 'week' } } }),
      ),
    ).toBeNull();
    expect(
      subscriptionView({
        items: { data: [] },
      } as unknown as Stripe.Subscription),
    ).toBeNull();
  });
});
