import { SubscriptionService } from '../subscription.service';

function serviceFor(invoices: Record<string, unknown>[]) {
  return new SubscriptionService(
    {
      findOne: jest.fn().mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_1',
      }),
    } as never,
    {
      isConfigured: true,
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
                  quantity: 1,
                  price: { recurring: { interval: 'year' } },
                },
              ],
            },
          }),
        },
        invoices: { list: jest.fn().mockResolvedValue({ data: invoices }) },
        billingPortal: {
          sessions: {
            create: jest
              .fn()
              .mockResolvedValue({ url: 'https://portal.test/s' }),
          },
        },
      },
    } as never,
    {
      forOrganisation: jest.fn().mockResolvedValue({ memberCount: 1 }),
    } as never,
  );
}

describe('listing invoices', () => {
  it('shapes a paid invoice for the page', async () => {
    const service = serviceFor([
      {
        id: 'in_1',
        status: 'paid',
        amount_due: 4200,
        currency: 'usd',
        invoice_pdf: 'https://stripe.test/in_1.pdf',
        created: 1793000000,
        status_transitions: { paid_at: 1793000500 },
        lines: { data: [{ quantity: 1, description: 'Hi Day Cloud' }] },
      },
    ]);

    await expect(service.invoicesFor('org-1')).resolves.toEqual([
      {
        id: 'in_1',
        // Paid wins over created: it is the date somebody was charged.
        date: new Date(1793000500 * 1000).toISOString(),
        amountMinor: 4200,
        currency: 'usd',
        status: 'paid',
        pdfUrl: 'https://stripe.test/in_1.pdf',
        description: '1 seat',
      },
    ]);
  });

  // `amount_paid` would read 0 for anything still open — the one row
  // somebody most wants the figure for.
  it('shows what an open invoice is for, not zero', async () => {
    const service = serviceFor([
      {
        id: 'in_2',
        status: 'open',
        amount_due: 16_800,
        currency: 'usd',
        created: 1793000000,
        status_transitions: {},
        lines: { data: [{ quantity: 54 }] },
      },
    ]);

    const [invoice] = await service.invoicesFor('org-1');
    expect(invoice).toMatchObject({
      amountMinor: 16_800,
      status: 'open',
      description: '54 seats',
      pdfUrl: null,
    });
  });

  it('falls back to the line description where there is no quantity', async () => {
    const service = serviceFor([
      {
        id: 'in_3',
        status: 'paid',
        amount_due: 500,
        currency: 'usd',
        created: 1793000000,
        status_transitions: {},
        lines: { data: [{ description: 'Proration' }] },
      },
    ]);

    const [invoice] = await service.invoicesFor('org-1');
    expect(invoice.description).toBe('Proration');
  });

  // Invoices are a read: failing to list them must not break the page.
  it('answers an empty list where Stripe cannot be reached', async () => {
    const service = new SubscriptionService(
      {
        findOne: jest.fn().mockResolvedValue({ stripeSubscriptionId: 'sub_1' }),
      } as never,
      {
        isConfigured: true,
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
                    quantity: 1,
                    price: { recurring: { interval: 'year' } },
                  },
                ],
              },
            }),
          },
          invoices: { list: jest.fn().mockRejectedValue(new Error('down')) },
        },
      } as never,
      {
        forOrganisation: jest.fn().mockResolvedValue({ memberCount: 1 }),
      } as never,
    );

    await expect(service.invoicesFor('org-1')).resolves.toEqual([]);
  });

  it('answers an empty list for an organisation with no subscription', async () => {
    const service = new SubscriptionService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { isConfigured: true, stripe: {} } as never,
      { forOrganisation: jest.fn() } as never,
    );

    await expect(service.invoicesFor('org-1')).resolves.toEqual([]);
  });
});

describe('the customer portal link', () => {
  it('opens a session against the stored customer', async () => {
    const service = serviceFor([]);

    await expect(
      service.portalUrl('org-1', 'https://app.test/billing'),
    ).resolves.toBe('https://portal.test/s');
  });

  // Nothing to manage before there is a Stripe customer, and a portal link
  // without one would 500 from Stripe instead of saying why.
  it('refuses where the organisation has no billing account yet', async () => {
    const service = new SubscriptionService(
      {
        findOne: jest.fn().mockResolvedValue({ stripeCustomerId: null }),
      } as never,
      { isConfigured: true, stripe: {} } as never,
      { forOrganisation: jest.fn() } as never,
    );

    await expect(
      service.portalUrl('org-1', 'https://app.test/billing'),
    ).rejects.toThrow(/no billing account/);
  });
});
