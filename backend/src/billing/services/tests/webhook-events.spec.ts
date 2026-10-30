import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HANDLED_STRIPE_EVENTS } from '../stripe-webhook.service';

/**
 * Reads the `switch` back out of the source. Unusual, and the point: the
 * array is what the Stripe endpoint gets subscribed to, and the switch is
 * what actually runs. If they drift, an event is either handled but never
 * delivered, or delivered for no reason — and neither failure says anything
 * out loud.
 */
function casesInHandle(): string[] {
  const source = readFileSync(
    join(__dirname, '..', 'stripe-webhook.service.ts'),
    'utf-8',
  );
  const handle = source.slice(
    source.indexOf('async handle('),
    source.indexOf('default:', source.indexOf('async handle(')),
  );
  return [...handle.matchAll(/case '([^']+)'/g)].map((match) => match[1]);
}

describe('the events we subscribe to', () => {
  it('matches the events the handler switches on', () => {
    expect([...HANDLED_STRIPE_EVENTS].sort()).toEqual(casesInHandle().sort());
  });

  it('lists each event once', () => {
    expect(new Set(HANDLED_STRIPE_EVENTS).size).toBe(
      HANDLED_STRIPE_EVENTS.length,
    );
  });

  // The test above is only worth anything if it can actually see the cases.
  it('finds the switch it is checking against', () => {
    expect(casesInHandle().length).toBeGreaterThan(0);
  });
});
