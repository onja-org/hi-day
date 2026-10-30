import type Stripe from 'stripe';
import {
  StripeWebhookService,
  UnplacedStripeEvent,
} from '../stripe-webhook.service';
import { SubscriptionStatus } from '../../../database/entities/subscription-status.enum';
import { ORGANISATION_METADATA_KEY } from '../checkout.service';

type Rows = {
  subscription?: Record<string, unknown> | null;
  organisation?: Record<string, unknown> | null;
  isFree?: boolean;
};

function serviceFor({
  subscription = null,
  organisation = { id: 'org-1', publicId: 100001 },
  isFree = false,
}: Rows) {
  const update = jest.fn();
  const service = new StripeWebhookService(
    { findOne: jest.fn().mockResolvedValue(subscription), update } as never,
    { findOne: jest.fn().mockResolvedValue(organisation) } as never,
    { isFree: () => isFree, isConfigured: true } as never,
    { sendInvoiceEmail: jest.fn() } as never,
    { get: () => 'whsec_test' } as never,
  );
  return { service, update };
}

const paidInvoice = {
  type: 'invoice.paid',
  data: {
    object: {
      id: 'in_1',
      parent: {
        subscription_details: {
          subscription: 'sub_1',
          metadata: { [ORGANISATION_METADATA_KEY]: 'org-1' },
        },
      },
    },
  },
} as unknown as Stripe.Event;

const subscriptionUpdated = {
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      items: { data: [{ current_period_end: 1793000000 }] },
      metadata: {},
    },
  },
} as unknown as Stripe.Event;

/**
 * The contract: a 2xx tells Stripe never to send the event again. Anything
 * we could not act on has to leave by an exception instead, or the money is
 * taken and the trial never ends.
 */
describe('events Stripe should send again', () => {
  it('asks for a retry when a paid invoice matches no organisation', async () => {
    const { service, update } = serviceFor({ subscription: null });

    await expect(service.handle(paidInvoice)).rejects.toBeInstanceOf(
      UnplacedStripeEvent,
    );
    expect(update).not.toHaveBeenCalled();
  });

  // The common race: Stripe pays the first invoice while
  // `checkout.session.completed` is still being written.
  it('asks for a retry when the organisation has no subscription row yet', async () => {
    const { service } = serviceFor({
      subscription: null,
      organisation: { id: 'org-1', publicId: 100001 },
    });

    await expect(service.handle(subscriptionUpdated)).rejects.toBeInstanceOf(
      UnplacedStripeEvent,
    );
  });

  it('asks for a retry when the organisation itself is not there', async () => {
    const { service } = serviceFor({
      subscription: {
        id: 'sub-row-1',
        organisationId: 'org-1',
        status: SubscriptionStatus.TRIALING,
      },
      organisation: null,
    });

    await expect(service.handle(paidInvoice)).rejects.toBeInstanceOf(
      UnplacedStripeEvent,
    );
  });

  it('carries a 503, which is the status that makes Stripe retry', () => {
    expect(new UnplacedStripeEvent('nope').getStatus()).toBe(503);
  });
});

describe('events we ignore on purpose', () => {
  // The failsafe: a free-by-config Organisation must never start owing
  // money, however often Stripe insists.
  it('accepts and drops an event for an organisation that never pays', async () => {
    const { service, update } = serviceFor({
      subscription: {
        id: 'sub-row-1',
        organisationId: 'org-1',
        status: SubscriptionStatus.TRIALING,
      },
      isFree: true,
    });

    await expect(service.handle(paidInvoice)).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * Neither stores anything: the Billing page reads a failing renewal off
   * the subscription's status, and Stripe's Smart Retries own the recovery.
   * They are therefore idempotent by having nothing to repeat.
   */
  it.each(['invoice.payment_failed', 'invoice.upcoming'])(
    'accepts %s without writing anything, however often it arrives',
    async (type) => {
      const { service, update } = serviceFor({});
      const event = { type, data: { object: { id: 'in_1' } } } as never;

      await expect(service.handle(event)).resolves.toBeUndefined();
      await expect(service.handle(event)).resolves.toBeUndefined();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('accepts an event type it does not handle', async () => {
    const { service, update } = serviceFor({});

    await expect(
      service.handle({
        type: 'payout.paid',
        data: { object: {} },
      } as unknown as Stripe.Event),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  // Metadata is fixed when the session is created, so a retry would carry
  // the same nothing.
  it('accepts a checkout session that carries no organisation', async () => {
    const { service, update } = serviceFor({});

    await expect(
      service.handle({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1', metadata: {} } },
      } as unknown as Stripe.Event),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
});
