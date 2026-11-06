import type Stripe from 'stripe';
import { hasEnded } from '../stripe-subscription-states';

describe('hasEnded', () => {
  it.each<Stripe.Subscription.Status>(['canceled', 'incomplete_expired'])(
    'treats %s as ended',
    (status) => {
      expect(hasEnded(status)).toBe(true);
    },
  );

  // `incomplete` is awaiting its first payment, which can still be made;
  // the rest can still charge.
  it.each<Stripe.Subscription.Status>([
    'incomplete',
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
  ])('treats %s as not ended', (status) => {
    expect(hasEnded(status)).toBe(false);
  });

  // Starting a second subscription beside one we cannot classify could
  // bill somebody twice.
  it('treats a status it has never heard of as not ended', () => {
    expect(hasEnded('something_new')).toBe(false);
  });
});
