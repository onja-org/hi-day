import { SubscriptionService } from '../subscription.service';

/** A preview line, in the shape Stripe returns it. */
function line(amount: number, proration: boolean) {
  return { amount, parent: { subscription_item_details: { proration } } };
}

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
    // Stripe puts the one-off proration and the next renewal on the *same*
    // preview, which is the whole reason these are read line by line.
    .mockResolvedValueOnce({
      amount_due: 243_600,
      lines: {
        data: [
          line(-209_520, true), // unused time at 50 seats, credited
          line(226_320, true), // remaining time at 54 seats
          line(226_800, false), // the renewal itself, 54 x $42
        ],
      },
    })
    .mockResolvedValueOnce({
      amount_due: 210_000,
      lines: { data: [line(210_000, false)] },
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

describe('previewing a seat change', () => {
  // The figures come from Stripe's own invoice preview. Ours disagreeing
  // with the invoice would be worse than showing nothing.
  it('asks Stripe what the change costs, old and new', async () => {
    const { service, createPreview } = serviceFor();

    const preview = await service.previewSeatChange('org-1', 54);

    expect(preview).toMatchObject({
      seats: 54,
      currentNextPaymentMinor: 210_000,
      // The renewal alone, without the one-off folded into it.
      nextPaymentMinor: 226_800,
      // The four extra seats for the rest of this period only:
      // $2,263.20 charged less $2,095.20 credited.
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

  // The bug this replaces. `amount_due` is the proration and the renewal
  // added together, so subtracting one preview's total from the other's
  // counted the recurring rise as if it were charged today — a real preview
  // of 5 annual seats going to 6 read "$83.91 charged" and "renewal
  // $293.91" against a true $41.90 and $252.00.
  it('does not mistake the renewal rise for money taken today', async () => {
    const { service, createPreview } = serviceFor({ quantity: 5 });
    createPreview
      .mockReset()
      .mockResolvedValueOnce({
        amount_due: 29_390,
        lines: {
          data: [line(-20_952, true), line(25_142, true), line(25_200, false)],
        },
      })
      .mockResolvedValueOnce({
        amount_due: 21_000,
        lines: { data: [line(21_000, false)] },
      });

    const preview = await service.previewSeatChange('org-1', 6);

    expect(preview.proratedNowMinor).toBe(4190);
    expect(preview.nextPaymentMinor).toBe(25_200);
    expect(preview.currentNextPaymentMinor).toBe(21_000);
    // The figures the old subtraction produced, now impossible.
    expect(preview.proratedNowMinor).not.toBe(8390);
    expect(preview.nextPaymentMinor).not.toBe(29_390);
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
              .mockResolvedValueOnce({
                amount_due: 100_000,
                lines: {
                  data: [
                    line(-209_520, true), // credited for 50 seats
                    line(83_808, true), // only 20 seats wanted now
                    line(84_000, false),
                  ],
                },
              })
              .mockResolvedValueOnce({
                amount_due: 210_000,
                lines: { data: [line(210_000, false)] },
              }),
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
