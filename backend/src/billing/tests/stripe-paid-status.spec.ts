import { stripeSaysPaid } from '../stripe-paid-status';

describe('stripeSaysPaid', () => {
  // Reachable only once a payment has succeeded.
  it.each(['active', 'past_due', 'unpaid', 'canceled', 'paused'])(
    'reads %s as paid',
    (status) => {
      expect(stripeSaysPaid(status)).toBe(true);
    },
  );

  // "Created, and the first payment never completed."
  it.each(['incomplete', 'incomplete_expired'])(
    'reads %s as never paid',
    (status) => {
      expect(stripeSaysPaid(status)).toBe(false);
    },
  );

  // We no longer hand Stripe a trial, so this should not occur — and if it
  // does, unpaid is the safe reading.
  it('reads trialing as never paid', () => {
    expect(stripeSaysPaid('trialing')).toBe(false);
  });

  it('reads nothing at all as never paid', () => {
    expect(stripeSaysPaid(null)).toBe(false);
    expect(stripeSaysPaid('')).toBe(false);
  });

  // A status Stripe adds later must not silently read as unpaid and revoke
  // somebody's subscription; the default is "they paid".
  it('reads an unfamiliar status as paid', () => {
    expect(stripeSaysPaid('some_future_status')).toBe(true);
  });
});
