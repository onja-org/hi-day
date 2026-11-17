import type Stripe from 'stripe';
import { StripeWebhookService } from '../stripe-webhook.service';
import { ORGANISATION_METADATA_KEY } from '../checkout.service';

/**
 * Stripe does not deliver events in order, and each carries a snapshot from
 * when it fired. A late `created` (still `incomplete`), or an older
 * `updated`, used to overwrite the live status and period end — a paying
 * Organisation's card turned amber and its grace dates moved. The handler
 * now writes what Stripe says about the subscription *now*.
 */

const LIVE_PERIOD_END = 1_800_000_000;
const STALE_PERIOD_END = 1_790_000_000;

function serviceFor(remote: () => Promise<unknown>) {
  const update = jest.fn();
  const retrieve = jest.fn(remote);
  const service = new StripeWebhookService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'row-1',
        organisationId: 'org-1',
        stripeSubscriptionId: 'sub_1',
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
  return { service, update, retrieve };
}

function subscription(status: string, periodEnd: number) {
  return {
    id: 'sub_1',
    status,
    created: 1_000,
    customer: 'cus_1',
    items: { data: [{ current_period_end: periodEnd }] },
    metadata: { [ORGANISATION_METADATA_KEY]: 'org-1' },
  };
}

function event(
  type: string,
  object: ReturnType<typeof subscription>,
): Stripe.Event {
  return { type, data: { object } } as unknown as Stripe.Event;
}

const liveNow = () => Promise.resolve(subscription('active', LIVE_PERIOD_END));

describe('subscription events arriving out of order', () => {
  it('ignores the stale status of a late "created" for a subscription now active', async () => {
    const { service, update } = serviceFor(liveNow);

    await service.handle(
      event(
        'customer.subscription.created',
        subscription('incomplete', STALE_PERIOD_END),
      ),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({
        stripeStatus: 'active',
        currentPeriodEnd: new Date(LIVE_PERIOD_END * 1000),
      }),
    );
  });

  it('keeps the live period end when an older "updated" lands last', async () => {
    const { service, update } = serviceFor(liveNow);

    await service.handle(
      event(
        'customer.subscription.updated',
        subscription('active', STALE_PERIOD_END),
      ),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({
        currentPeriodEnd: new Date(LIVE_PERIOD_END * 1000),
      }),
    );
  });

  it('asks Stripe about the subscription the event names', async () => {
    const { service, retrieve } = serviceFor(liveNow);

    await service.handle(
      event('customer.subscription.updated', subscription('active', 1)),
    );

    expect(retrieve).toHaveBeenCalledWith('sub_1');
  });

  // Nothing newer exists to ask, so the event is the last word there is.
  it('goes by the event when Stripe no longer has the subscription', async () => {
    const { service, update } = serviceFor(() =>
      Promise.reject(
        Object.assign(new Error('No such subscription'), {
          code: 'resource_missing',
        }),
      ),
    );

    await service.handle(
      event(
        'customer.subscription.deleted',
        subscription('canceled', STALE_PERIOD_END),
      ),
    );

    expect(update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({ stripeStatus: 'canceled' }),
    );
  });

  // Writing the event's snapshot here would be the very bug; failing makes
  // Stripe send it again, by which time it can be checked.
  it('asks Stripe to retry when it cannot say what the subscription is now', async () => {
    const { service, update } = serviceFor(() =>
      Promise.reject(new Error('Stripe is unreachable')),
    );

    await expect(
      service.handle(
        event(
          'customer.subscription.created',
          subscription('incomplete', STALE_PERIOD_END),
        ),
      ),
    ).rejects.toThrow('Stripe is unreachable');
    expect(update).not.toHaveBeenCalled();
  });
});
