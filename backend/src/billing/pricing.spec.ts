import {
  BILLING_PERIODS,
  CLOUD_PRICES,
  formatMinor,
  monthlyEquivalentMinor,
  monthlyPriceLabel,
  TRIAL_PROMISE,
} from './pricing';

describe('cloud prices', () => {
  it('bills annual as one yearly charge, not twelve monthly ones', () => {
    expect(CLOUD_PRICES.annual).toEqual({
      amountMinor: 4200,
      currency: 'usd',
      interval: 'year',
    });
  });

  it('advertises the monthly-equivalent the pricing page leads with', () => {
    expect(monthlyPriceLabel('monthly')).toBe('$4');
    expect(monthlyPriceLabel('annual')).toBe('$3.50');
  });

  it('derives the annual figure from the yearly amount, not the other way round', () => {
    expect(monthlyEquivalentMinor(CLOUD_PRICES.annual)).toBe(350);
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

  it('keeps both periods offered', () => {
    expect(BILLING_PERIODS).toEqual(['monthly', 'annual']);
  });

  it('builds the trial promise from the trial length', () => {
    expect(TRIAL_PROMISE).toBe('14-day free trial, no credit card required.');
  });
});
