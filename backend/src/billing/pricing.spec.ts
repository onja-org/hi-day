import {
  CLOUD_PRICES,
  formatMinor,
  monthlyEquivalentMinor,
  monthlyPriceLabel,
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
