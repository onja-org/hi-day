import { SubscriptionService } from '../subscription.service';

type Remote = {
  interval?: 'year' | 'month';
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
  status?: string;
};

function serviceFor({
  interval = 'year',
  quantity = 50,
  cancelAtPeriodEnd = false,
  status = 'active',
}: Remote = {}) {
  const update = jest.fn().mockResolvedValue({});
  const createPreview = jest
    .fn()
    // Proposed first, then current — `previewSeatChange` asks in that order.
    .mockResolvedValueOnce({
      amount_due: 226_800,
      next_payment_attempt: 1800000000,
    })
    .mockResolvedValueOnce({
      amount_due: 210_000,
      next_payment_attempt: 1800000000,
    });

  const service = new SubscriptionService(
    {
      findOne: jest.fn().mockResolvedValue({ stripeSubscriptionId: 'sub_1' }),
    } as never,
    {
      isConfigured: true,
      priceDataFor: (period: string) =>
        Promise.resolve({ product: 'prod_1', recurring: { interval: period } }),
      stripe: {
        subscriptions: {
          retrieve: jest.fn().mockResolvedValue({
            id: 'sub_1',
            status,
            currency: 'usd',
            cancel_at_period_end: cancelAtPeriodEnd,
            start_date: 1790000000,
            default_payment_method: { card: { brand: 'visa', last4: '4242' } },
            items: {
              data: [
                {
                  id: 'si_1',
                  quantity,
                  current_period_end: 1800000000,
                  price: { recurring: { interval } },
                },
              ],
            },
          }),
          update,
        },
        invoices: {
          createPreview,
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as never,
    {
      forOrganisation: jest.fn().mockResolvedValue({ memberCount: 54 }),
    } as never,
  );
  return { service, update, createPreview };
}

describe('auto-renew', () => {
  // Not `subscriptions.cancel`: that ends it on the spot and is terminal,
  // taking away a period somebody has already paid for.
  it('turns off by setting cancel_at_period_end', async () => {
    const { service, update } = serviceFor();

    await service.setAutoRenew('org-1', false);

    expect(update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: true,
    });
  });

  it('turns back on by clearing it', async () => {
    const { service, update } = serviceFor({ cancelAtPeriodEnd: true });

    await service.setAutoRenew('org-1', true);

    expect(update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: false,
    });
  });
});

describe('previewing a seat change', () => {
  // The figures come from Stripe's own invoice preview. Ours disagreeing
  // with the invoice would be worse than showing nothing.
  it('asks Stripe what the change costs, old and new', async () => {
    const { service, createPreview } = serviceFor();

    const preview = await service.previewSeatChange('org-1', 54);

    expect(preview).toMatchObject({
      seats: 54,
      currentNextPaymentMinor: 210_000,
      nextPaymentMinor: 226_800,
      proratedNowMinor: 16_800,
      currency: 'usd',
    });
    expect(createPreview).toHaveBeenNthCalledWith(1, {
      subscription: 'sub_1',
      subscription_details: {
        items: [{ id: 'si_1', quantity: 54 }],
        proration_behavior: 'create_prorations',
      },
    });
  });

  // Lowering seats produces a credit, which is not a charge to warn about.
  it('never reports a negative amount as a charge', async () => {
    const { service } = serviceFor();
    const lower = new SubscriptionService(
      {
        findOne: jest.fn().mockResolvedValue({ stripeSubscriptionId: 'sub_1' }),
      } as never,
      {
        isConfigured: true,
        priceDataFor: () => Promise.resolve({ product: 'prod_1' }),
        stripe: {
          subscriptions: {
            retrieve: jest.fn().mockResolvedValue({
              id: 'sub_1',
              currency: 'usd',
              status: 'active',
              items: {
                data: [
                  {
                    id: 'si_1',
                    quantity: 50,
                    price: { recurring: { interval: 'year' } },
                  },
                ],
              },
            }),
            update: jest.fn(),
          },
          invoices: {
            createPreview: jest
              .fn()
              .mockResolvedValueOnce({ amount_due: 100_000 })
              .mockResolvedValueOnce({ amount_due: 210_000 }),
            list: jest.fn().mockResolvedValue({ data: [] }),
          },
        },
      } as never,
      {
        forOrganisation: jest.fn().mockResolvedValue({ memberCount: 10 }),
      } as never,
    );
    expect(service).toBeDefined();

    await expect(lower.previewSeatChange('org-1', 20)).resolves.toMatchObject({
      proratedNowMinor: 0,
    });
  });
});

describe('switching cycle', () => {
  it('moves the item to the other price and lets Stripe prorate', async () => {
    const { service, update } = serviceFor({ interval: 'year' });

    await service.switchCycle('org-1', 'monthly');

    // The amount is passed inline from `CLOUD_PRICES` rather than naming a
    // Price object, so nothing has to exist in Stripe before this works.
    expect(update).toHaveBeenCalledWith('sub_1', {
      items: [
        {
          id: 'si_1',
          price_data: { product: 'prod_1', recurring: { interval: 'monthly' } },
          quantity: 50,
        },
      ],
      proration_behavior: 'create_prorations',
    });
  });

  it('refuses a cycle we do not sell', async () => {
    const { service } = serviceFor();

    await expect(
      service.switchCycle('org-1', 'weekly' as never),
    ).rejects.toThrow();
  });
});

describe('the read model', () => {
  it('reads plan, seats, card and members together', async () => {
    const { service } = serviceFor({ interval: 'year', quantity: 50 });

    await expect(service.detailsFor('org-1')).resolves.toMatchObject({
      plan: 'annual',
      seatsPaid: 50,
      memberCount: 54,
      card: { brand: 'visa', last4: '4242' },
      cancelAtPeriodEnd: false,
      paymentFailed: false,
    });
  });

  it('reports a failing renewal for the update-your-card state', async () => {
    const { service } = serviceFor({ status: 'past_due' });

    await expect(service.detailsFor('org-1')).resolves.toMatchObject({
      status: 'past_due',
      paymentFailed: true,
    });
  });
});
