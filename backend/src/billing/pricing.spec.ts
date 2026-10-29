import {
  CLOUD_PRICES,
  formatMinor,
  monthlyEquivalentMinor,
  monthlyPriceLabel,
  nextPaymentFrom,
} from './pricing';

describe('cloud prices', () => {
  it('advertises the monthly-equivalent the pricing page leads with', () => {
    expect(monthlyPriceLabel('monthly')).toBe('$4');
    expect(monthlyPriceLabel('annual')).toBe('$3.50');
  });

  /**
   * The real saving is 12.5%; the pricing page's pill rounds it down to
   * "Save 12%". Understating it is the safe direction, but the two are not
   * the same number and a change to either amount has to keep it that way.
   */
  it('makes annual 12.5% cheaper, which the page rounds down to 12%', () => {
    const monthly = monthlyEquivalentMinor(CLOUD_PRICES.monthly);
    const annual = monthlyEquivalentMinor(CLOUD_PRICES.annual);

    expect((1 - annual / monthly) * 100).toBeCloseTo(12.5);
  });

  it('writes a whole amount without decimals and a part amount with them', () => {
    expect(formatMinor(400, 'usd')).toBe('$4');
    expect(formatMinor(350, 'usd')).toBe('$3.50');
    expect(formatMinor(4200, 'usd')).toBe('$42');
  });
});

describe('nextPaymentFrom', () => {
  it('is a month on for a monthly cycle', () => {
    expect(
      nextPaymentFrom(new Date('2026-01-15T09:00:00.000Z'), 'monthly'),
    ).toEqual(new Date('2026-02-15T09:00:00.000Z'));
  });

  it('is a year on for an annual cycle', () => {
    expect(
      nextPaymentFrom(new Date('2026-01-15T09:00:00.000Z'), 'annual'),
    ).toEqual(new Date('2027-01-15T09:00:00.000Z'));
  });

  // Calendar months, not 30 days: a renewal that drifts a day per cycle is
  // a support ticket.
  it('keeps the day of the month across a short month', () => {
    expect(
      nextPaymentFrom(
        new Date('2026-01-31T09:00:00.000Z'),
        'monthly',
      ).getUTCMonth(),
    ).toBe(2); // March — January 31 has no February 31, so Postgres-free JS rolls it
  });

  it('handles a leap day on an annual cycle', () => {
    const next = nextPaymentFrom(
      new Date('2028-02-29T09:00:00.000Z'),
      'annual',
    );
    expect(next.getUTCFullYear()).toBe(2029);
  });
});
