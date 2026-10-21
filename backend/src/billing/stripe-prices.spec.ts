import { CLOUD_PRICES } from './pricing';
import {
  describeMismatches,
  findPriceMismatch,
  type StripePriceShape,
} from './stripe-prices';

const matching: StripePriceShape = {
  id: 'price_monthly',
  unit_amount: 400,
  currency: 'usd',
  recurring: { interval: 'month' },
};

describe('findPriceMismatch', () => {
  it('passes a Stripe Price that charges what we advertise', () => {
    expect(
      findPriceMismatch('monthly', CLOUD_PRICES.monthly, matching),
    ).toBeNull();
  });

  it('catches a different amount — the silent overcharge', () => {
    const mismatch = findPriceMismatch('monthly', CLOUD_PRICES.monthly, {
      ...matching,
      unit_amount: 500,
    });

    expect(mismatch).toMatchObject({
      expected: '400 usd/month',
      found: '500 usd/month',
    });
  });

  it('catches a different interval, which is a twelvefold error', () => {
    const mismatch = findPriceMismatch('annual', CLOUD_PRICES.annual, {
      id: 'price_annual',
      unit_amount: 4200,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    expect(mismatch?.found).toBe('4200 usd/month');
  });

  it('catches a different currency', () => {
    expect(
      findPriceMismatch('monthly', CLOUD_PRICES.monthly, {
        ...matching,
        currency: 'eur',
      }),
    ).not.toBeNull();
  });

  it('catches a one-off price where a recurring one is wanted', () => {
    const mismatch = findPriceMismatch('monthly', CLOUD_PRICES.monthly, {
      ...matching,
      recurring: null,
    });

    expect(mismatch?.found).toBe('400 usd/one-off');
  });

  it('says which price is wrong and both figures', () => {
    const mismatch = findPriceMismatch('monthly', CLOUD_PRICES.monthly, {
      ...matching,
      unit_amount: 500,
    })!;

    expect(describeMismatches([mismatch])).toBe(
      'monthly (price_monthly): Stripe charges 500 usd/month, this app advertises 400 usd/month',
    );
  });
});
