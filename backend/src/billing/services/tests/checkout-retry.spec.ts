import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from '../checkout.service';

/**
 * Paying again after a first attempt left a subscription behind: a declined
 * card or failed 3-D Secure (`incomplete`), one Stripe expired after 23
 * hours (`incomplete_expired`), or a customer who cancelled and came back
 * (`canceled`). Having any stored id used to refuse all of these for good.
 */

const missing = Object.assign(new Error('No such object'), {
  code: 'resource_missing',
});

type Stored = {
  id: string;
  status: string;
  quantity?: number;
  period?: string;
  clientSecret?: string | null;
};

function makeService({
  row = { stripeSubscriptionId: 'sub_old', stripeCustomerId: 'cus_1' },
  stored,
  storedError,
  customer = { id: 'cus_1' },
  customerError,
  seats = 5,
}: {
  row?: Record<string, unknown> | null;
  stored?: Stored;
  storedError?: unknown;
  customer?: Record<string, unknown>;
  customerError?: unknown;
  seats?: number;
} = {}) {
  const retrieve = storedError
    ? jest.fn().mockRejectedValue(storedError)
    : jest.fn().mockResolvedValue(
        stored && {
          id: stored.id,
          status: stored.status,
          metadata: { period: stored.period ?? 'monthly' },
          items: { data: [{ quantity: stored.quantity ?? seats }] },
          latest_invoice:
            stored.clientSecret === null
              ? null
              : {
                  confirmation_secret: {
                    client_secret: stored.clientSecret ?? 'secret_old',
                  },
                },
        },
      );
  const stripe = {
    subscriptions: {
      retrieve,
      cancel: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({
        id: 'sub_new',
        latest_invoice: {
          confirmation_secret: { client_secret: 'secret_new' },
        },
      }),
    },
    customers: {
      retrieve: customerError
        ? jest.fn().mockRejectedValue(customerError)
        : jest.fn().mockResolvedValue(customer),
      create: jest.fn().mockResolvedValue({ id: 'cus_created' }),
    },
    checkout: {
      sessions: {
        create: jest
          .fn()
          .mockResolvedValue({ url: 'https://checkout.stripe.test/s' }),
      },
    },
  };
  const service = new CheckoutService(
    { findOne: jest.fn().mockResolvedValue(row) } as never,
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'org-1',
        publicId: 100001,
        name: 'Acme',
        billingEmail: null,
      }),
    } as never,
    {
      isConfigured: true,
      isFree: () => false,
      priceDataFor: () => Promise.resolve({ product: 'prod_1' }),
      stripe,
    } as never,
    { forOrganisation: jest.fn().mockResolvedValue({ count: seats }) } as never,
    { getOrThrow: () => 'https://app.example.com' } as never,
  );
  return { service, stripe };
}

describe('paying again after an earlier attempt', () => {
  describe('a first payment still awaited (declined card, failed 3-D Secure)', () => {
    // The retry the bug made impossible: the same open invoice, confirmed
    // again with another card.
    it('hands back the same open payment for the same order', async () => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status: 'incomplete' },
      });

      const intent = await service.createSubscriptionIntent(
        'org-1',
        'monthly',
        5,
      );

      expect(intent.clientSecret).toBe('secret_old');
      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    // The old invoice is for the wrong amount; left open, it could be paid
    // later beside the new one.
    it.each([
      ['the seat count', { quantity: 3 }],
      ['the billing cycle', { period: 'annual' }],
    ])(
      'cancels it and starts again when %s changed',
      async (_, change: Partial<Stored>) => {
        const { service, stripe } = makeService({
          stored: { id: 'sub_old', status: 'incomplete', ...change },
        });

        const intent = await service.createSubscriptionIntent(
          'org-1',
          'monthly',
          5,
        );

        expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_old');
        expect(intent.clientSecret).toBe('secret_new');
        expect(stripe.subscriptions.create).toHaveBeenCalledWith(
          expect.objectContaining({ customer: 'cus_1' }),
        );
      },
    );

    it('starts again when the old one has no payment left to confirm', async () => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status: 'incomplete', clientSecret: null },
      });

      const intent = await service.createSubscriptionIntent('org-1', 'monthly');

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_old');
      expect(intent.clientSecret).toBe('secret_new');
    });
  });

  it.each(['incomplete_expired', 'canceled'])(
    'starts a new subscription beside one that is %s, for the same customer',
    async (status) => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status },
      });

      const intent = await service.createSubscriptionIntent('org-1', 'monthly');

      expect(intent.clientSecret).toBe('secret_new');
      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_1' }),
      );
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    },
  );

  // A second subscription beside one that can still charge bills twice.
  it.each(['active', 'trialing', 'paused', 'something_new'])(
    'refuses beside a subscription that is %s',
    async (status) => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status },
      });

      await expect(
        service.createSubscriptionIntent('org-1', 'monthly'),
      ).rejects.toThrow('This organisation already has a subscription.');
      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    },
  );

  // A failed renewal is fixed by updating the card, not by buying again.
  it.each(['past_due', 'unpaid'])(
    'points a %s subscription at updating the card',
    async (status) => {
      const { service } = makeService({ stored: { id: 'sub_old', status } });

      await expect(
        service.createSubscriptionIntent('org-1', 'monthly'),
      ).rejects.toThrow(/Update the card under Manage billing/);
    },
  );

  it('starts afresh when Stripe no longer has the stored subscription', async () => {
    const { service, stripe } = makeService({ storedError: missing });

    const intent = await service.createSubscriptionIntent('org-1', 'monthly');

    expect(intent.clientSecret).toBe('secret_new');
    expect(stripe.subscriptions.create).toHaveBeenCalled();
  });

  // Refusing is the safe answer when we can't tell whether it still bills.
  it('fails rather than guessing when Stripe cannot be reached', async () => {
    const { service, stripe } = makeService({
      storedError: new Error('ECONNRESET'),
    });

    await expect(
      service.createSubscriptionIntent('org-1', 'monthly'),
    ).rejects.toThrow('ECONNRESET');
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('creates a new customer when the stored one was deleted', async () => {
    const { service, stripe } = makeService({
      stored: { id: 'sub_old', status: 'canceled' },
      customer: { id: 'cus_1', deleted: true },
    });

    await service.createSubscriptionIntent('org-1', 'monthly');

    expect(stripe.customers.create).toHaveBeenCalled();
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_created' }),
    );
  });

  it('creates a customer for a first-ever payment', async () => {
    const { service, stripe } = makeService({ row: null });

    await service.createSubscriptionIntent('org-1', 'monthly');

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.customers.create).toHaveBeenCalled();
  });

  describe("Stripe's hosted checkout (the fallback)", () => {
    it('lets a customer who cancelled come back, as the same customer', async () => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status: 'canceled' },
      });

      await expect(service.createSessionUrl('org-1', 'monthly')).resolves.toBe(
        'https://checkout.stripe.test/s',
      );
      const [params] = stripe.checkout.sessions.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(params.customer).toBe('cus_1');
      expect(params).not.toHaveProperty('customer_email');
    });

    // Checkout raises its own subscription; the modal's unpaid one must not
    // stay payable beside it.
    it('cancels a subscription left awaiting its first payment', async () => {
      const { service, stripe } = makeService({
        stored: { id: 'sub_old', status: 'incomplete' },
      });

      await service.createSessionUrl('org-1', 'monthly');

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_old');
    });

    it('refuses beside a live subscription, like the modal', async () => {
      const { service } = makeService({
        stored: { id: 'sub_old', status: 'active' },
      });

      await expect(
        service.createSessionUrl('org-1', 'monthly'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
