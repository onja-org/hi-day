import { StripeService } from '../stripe.service';
import { CLOUD_PRICES, CLOUD_PRODUCT_NAME } from '../../pricing';

function serviceFor({
  productId,
  found = [],
}: { productId?: string; found?: { id: string }[] } = {}) {
  const search = jest.fn().mockResolvedValue({ data: found });
  const create = jest.fn().mockResolvedValue({ id: 'prod_created' });
  const service = new StripeService({
    get: (key: string) =>
      key === 'STRIPE_SECRET_KEY'
        ? 'sk_test'
        : key === 'STRIPE_PRODUCT_ID'
          ? productId
          : undefined,
  } as never);
  // The constructor builds a real client; only the product calls are used.
  Object.defineProperty(service, 'client', {
    value: { products: { search, create } },
  });
  return { service, search, create };
}

/**
 * Prices used to live here *and* as Stripe Price objects named by
 * environment variables, with a start-up check refusing to boot when they
 * disagreed. Passing them inline removes the duplication and the check.
 */
describe('the price it charges', () => {
  it('builds the amount from this app’s own constants', async () => {
    const { service } = serviceFor({ productId: 'prod_configured' });

    await expect(service.priceDataFor('annual')).resolves.toEqual({
      currency: CLOUD_PRICES.annual.currency,
      product: 'prod_configured',
      recurring: { interval: 'year' },
      unit_amount: CLOUD_PRICES.annual.amountMinor,
    });
  });

  it('prices monthly by the month', async () => {
    const { service } = serviceFor({ productId: 'prod_configured' });

    await expect(service.priceDataFor('monthly')).resolves.toMatchObject({
      recurring: { interval: 'month' },
      unit_amount: CLOUD_PRICES.monthly.amountMinor,
    });
  });

  // Nothing has to be created in the Stripe dashboard first.
  it('needs no Price object to exist', async () => {
    const { service } = serviceFor({ productId: 'prod_configured' });

    const data = await service.priceDataFor('annual');

    expect(data).not.toHaveProperty('price');
    expect(data).not.toHaveProperty('id');
  });
});

describe('the Product it hangs them off', () => {
  it('uses the configured one, asking Stripe nothing', async () => {
    const { service, search, create } = serviceFor({
      productId: 'prod_configured',
    });

    await service.priceDataFor('annual');

    expect(search).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  // Found before created, so a restart does not leave a trail of duplicates.
  it('reuses one it finds by name', async () => {
    const { service, create } = serviceFor({ found: [{ id: 'prod_found' }] });

    await expect(service.priceDataFor('annual')).resolves.toMatchObject({
      product: 'prod_found',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates one where there is none', async () => {
    const { service, create } = serviceFor();

    await expect(service.priceDataFor('annual')).resolves.toMatchObject({
      product: 'prod_created',
    });
    expect(create).toHaveBeenCalledWith({ name: CLOUD_PRODUCT_NAME });
  });

  // Cached for the process, so the common path costs no API call.
  it('looks it up once however many charges follow', async () => {
    const { service, search, create } = serviceFor();

    await service.priceDataFor('annual');
    await service.priceDataFor('monthly');
    await service.priceDataFor('annual');

    expect(search).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
