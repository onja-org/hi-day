import type Stripe from 'stripe';
import { StripeWebhookService } from '../stripe-webhook.service';
import { ORGANISATION_METADATA_KEY } from '../checkout.service';

/**
 * An Organisation can go through several Stripe subscriptions — a retry
 * after a declined card, a customer coming back after cancelling — and
 * Stripe does not deliver events in order. Whichever subscription is
 * newest and not finished is the one our row must keep pointing at.
 */

const STORED_CREATED = 2_000;

function serviceFor(storedId: string | null, storedStatus = 'active') {
  const update = jest.fn();
  const retrieve = jest.fn().mockResolvedValue({
    id: storedId,
    created: STORED_CREATED,
    status: storedStatus,
  });
  const service = new StripeWebhookService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'row-1',
        organisationId: 'org-1',
        stripeSubscriptionId: storedId,
      }),
      update,
    } as never,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'org-1', publicId: 100001 }),
    } as never,
    {
      isFree: () => false,
      isConfigured: true,
      stripe: { subscriptions: { retrieve } },
    } as never,
    { sendInvoiceEmail: jest.fn() } as never,
    { get: () => 'whsec_test' } as never,
  );
  return { service, update };
}

function subscriptionEvent(
  id: string,
  status: string,
  created: number,
): Stripe.Event {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id,
        status,
        created,
        customer: 'cus_1',
        items: { data: [{ current_period_end: 1793000000 }] },
        metadata: { [ORGANISATION_METADATA_KEY]: 'org-1' },
      },
    },
  } as unknown as Stripe.Event;
}

describe('a subscription replaced by a newer one', () => {
  it('keeps the stored one when the replaced one is cancelled late', async () => {
    const { service, update } = serviceFor('sub_new');

    await service.handle(
      subscriptionEvent('sub_old', 'canceled', STORED_CREATED - 100),
    );

    expect(update).not.toHaveBeenCalled();
  });

  // The dangerous one: still `incomplete`, so not ended, but older. Had it
  // won, a paid subscription would be forgotten and paying again would
  // bill twice.
  it('keeps the stored one when an older, unfinished one reports late', async () => {
    const { service, update } = serviceFor('sub_new');

    await service.handle(
      subscriptionEvent('sub_old', 'incomplete', STORED_CREATED - 100),
    );

    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['a customer coming back after cancelling', 'canceled'],
    ['a retry after the stored attempt expired', 'incomplete_expired'],
    ['a new attempt replacing an unpaid one', 'incomplete'],
  ])('switches to a newer subscription: %s', async (_, storedStatus) => {
    const { service, update } = serviceFor('sub_old', storedStatus);

    await service.handle(
      subscriptionEvent('sub_new', 'incomplete', STORED_CREATED + 100),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({
        stripeSubscriptionId: 'sub_new',
        stripeStatus: 'incomplete',
      }),
    );
  });

  // The two-tab hole: tab A pays, tab B's unpaid attempt was created a
  // moment later. Letting B win would orphan the paid subscription the
  // moment B expired.
  it('keeps a live stored one over a newer attempt still awaiting payment', async () => {
    const { service, update } = serviceFor('sub_paid', 'active');

    await service.handle(
      subscriptionEvent('sub_unpaid', 'incomplete', STORED_CREATED + 100),
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('switches to a newer one that is live over a stored one that is live', async () => {
    const { service, update } = serviceFor('sub_old', 'active');

    await service.handle(
      subscriptionEvent('sub_new', 'active', STORED_CREATED + 100),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({ stripeSubscriptionId: 'sub_new' }),
    );
  });

  // A late "expired" for one already replaced, even if Stripe dates it
  // after the stored one, never takes over.
  it('never switches to one that has already ended', async () => {
    const { service, update } = serviceFor('sub_old');

    await service.handle(
      subscriptionEvent('sub_new', 'incomplete_expired', STORED_CREATED + 100),
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('records the stored subscription ending as usual', async () => {
    const { service, update } = serviceFor('sub_1');

    await service.handle(
      subscriptionEvent('sub_1', 'canceled', STORED_CREATED),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({ stripeStatus: 'canceled' }),
    );
  });

  it('records the first subscription an Organisation ever has', async () => {
    const { service, update } = serviceFor(null);

    await service.handle(subscriptionEvent('sub_1', 'incomplete', 1_000));

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
    );
  });
});
