import { SubscriptionReconcilerService } from '../subscription-reconciler.service';
import { SubscriptionStatus } from '../../../database/entities/subscription-status.enum';

type Setup = {
  row?: Record<string, unknown> | null;
  remoteStatus?: string;
  isConfigured?: boolean;
  retrieveThrows?: boolean;
};

const TRIALING_WITH_STRIPE_SUB = {
  id: 'sub-row-1',
  organisationId: 'org-1',
  status: SubscriptionStatus.TRIALING,
  stripeSubscriptionId: 'sub_1',
};

function serviceFor({
  row = TRIALING_WITH_STRIPE_SUB,
  remoteStatus = 'active',
  isConfigured = true,
  retrieveThrows = false,
}: Setup) {
  const update = jest.fn().mockResolvedValue(undefined);
  const retrieve = jest.fn(() =>
    retrieveThrows
      ? Promise.reject(new Error('stripe is down'))
      : Promise.resolve({ status: remoteStatus, start_date: 1793000000 }),
  );
  const service = new SubscriptionReconcilerService(
    { findOne: jest.fn().mockResolvedValue(row), update } as never,
    {
      isConfigured,
      stripe: { subscriptions: { retrieve } },
    } as never,
  );
  return { service, update, retrieve };
}

/**
 * The repair path for a payment whose webhook never arrived — the state
 * that leaves somebody charged by Stripe and staring at a trial banner.
 */
describe('reconciling a paid subscription that still says trialing', () => {
  it('turns it active and stamps when the trial actually ended', async () => {
    const { service, update } = serviceFor({});

    await expect(service.reconcile('org-1')).resolves.toBe(true);

    const [id, fields] = update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe('sub-row-1');
    expect(fields.status).toBe(SubscriptionStatus.ACTIVE);
    // Stripe's own date, not today's — the repair may run days later.
    expect(fields.trialEndedAt).toEqual(new Date(1793000000 * 1000));
    expect(fields.stripeStatus).toBe('active');
  });

  // Reachable only after money arrived, so all of these mean "they paid".
  it.each(['active', 'past_due', 'unpaid', 'canceled'])(
    'repairs on a remote status of %s',
    async (remoteStatus) => {
      const { service, update } = serviceFor({ remoteStatus });

      await expect(service.reconcile('org-1')).resolves.toBe(true);
      expect(update).toHaveBeenCalled();
    },
  );

  it('leaves a subscription whose first payment never completed alone', async () => {
    const { service, update } = serviceFor({ remoteStatus: 'incomplete' });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('what the reconciler refuses to spend a round trip on', () => {
  // Every ordinary trial: no Stripe subscription to ask about.
  it('asks nothing for a trial that never reached checkout', async () => {
    const { service, retrieve } = serviceFor({
      row: { ...TRIALING_WITH_STRIPE_SUB, stripeSubscriptionId: null },
    });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  // Every already-paying organisation: nothing to repair, and this runs on
  // every load of the billing page.
  it('asks nothing for a subscription already active', async () => {
    const { service, retrieve } = serviceFor({
      row: { ...TRIALING_WITH_STRIPE_SUB, status: SubscriptionStatus.ACTIVE },
    });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('asks nothing for an organisation with no subscription row', async () => {
    const { service, retrieve } = serviceFor({ row: null });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('asks nothing where Stripe is not configured at all', async () => {
    const { service, retrieve } = serviceFor({ isConfigured: false });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe('when the repair itself fails', () => {
  // A repair that throws would take the billing page down with it — the one
  // page somebody opens when their billing looks wrong.
  it('answers calmly rather than breaking the page', async () => {
    const { service, update } = serviceFor({ retrieveThrows: true });

    await expect(service.reconcile('org-1')).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('running it twice', () => {
  // Same transition the webhook makes, and equally idempotent: the second
  // call stops at the status guard.
  it('repairs once and then does nothing', async () => {
    const { service, update, retrieve } = serviceFor({});
    await service.reconcile('org-1');

    const second = serviceFor({
      row: { ...TRIALING_WITH_STRIPE_SUB, status: SubscriptionStatus.ACTIVE },
    });
    await second.service.reconcile('org-1');

    expect(update).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(second.update).not.toHaveBeenCalled();
  });
});
