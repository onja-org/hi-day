import {
  RENEWAL_STOPPED_BY_DELETION_KEY,
  SubscriptionCancellationService,
} from '../subscription-cancellation.service';

type Remote = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
};

function makeService({
  row = { organisationId: 'org-1', stripeSubscriptionId: 'sub_1' },
  remote = {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    metadata: {},
  },
  retrieveError,
  cancelError,
}: {
  row?: Record<string, unknown> | null;
  remote?: Remote;
  retrieveError?: unknown;
  cancelError?: unknown;
} = {}) {
  const retrieve = retrieveError
    ? jest.fn().mockRejectedValue(retrieveError)
    : jest.fn().mockResolvedValue(remote);
  const update = jest.fn().mockResolvedValue(undefined);
  const cancel = cancelError
    ? jest.fn().mockRejectedValue(cancelError)
    : jest.fn().mockResolvedValue(undefined);
  const service = new SubscriptionCancellationService(
    { findOne: jest.fn().mockResolvedValue(row) } as never,
    { stripe: { subscriptions: { retrieve, update, cancel } } } as never,
  );
  return { service, retrieve, update, cancel };
}

const missing = Object.assign(new Error('No such subscription'), {
  code: 'resource_missing',
});

describe('SubscriptionCancellationService', () => {
  describe('stopRenewal', () => {
    it('stops renewal at the period end and marks deletion as the reason', async () => {
      const { service, update } = makeService();

      await service.stopRenewal('org-1');

      expect(update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
        metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: 'true' },
      });
    });

    // Their own choice, made before deletion: marking it would have a
    // restore switch auto-renew back on behind their back.
    it('leaves a subscription the customer already set not to renew unmarked', async () => {
      const { service, update } = makeService({
        remote: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: true,
          metadata: {},
        },
      });

      await service.stopRenewal('org-1');

      expect(update).not.toHaveBeenCalled();
    });

    it.each(['canceled', 'incomplete_expired'])(
      'does nothing for a subscription that is already %s',
      async (status) => {
        const { service, update } = makeService({
          remote: {
            id: 'sub_1',
            status,
            cancel_at_period_end: false,
            metadata: {},
          },
        });

        await service.stopRenewal('org-1');

        expect(update).not.toHaveBeenCalled();
      },
    );

    // Every trial and every free-by-config organisation.
    it('does nothing for an organisation that never subscribed', async () => {
      const { service, retrieve, update } = makeService({
        row: { organisationId: 'org-1', stripeSubscriptionId: null },
      });

      await service.stopRenewal('org-1');

      expect(retrieve).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('does nothing when Stripe has no such subscription', async () => {
      const { service, update } = makeService({ retrieveError: missing });

      await expect(service.stopRenewal('org-1')).resolves.toBeUndefined();
      expect(update).not.toHaveBeenCalled();
    });

    // The caller logs and the hourly job retries; swallowing it here would
    // hide that the subscription is still renewing.
    it('throws when Stripe cannot be reached', async () => {
      const { service } = makeService({
        retrieveError: new Error('ECONNRESET'),
      });

      await expect(service.stopRenewal('org-1')).rejects.toThrow('ECONNRESET');
    });
  });

  describe('resumeRenewal', () => {
    it('renews again and clears the mark when deletion stopped it', async () => {
      const { service, update } = makeService({
        remote: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: true,
          metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: 'true' },
        },
      });

      await service.resumeRenewal('org-1');

      expect(update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: false,
        metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: '' },
      });
    });

    it('leaves renewal off when the customer turned it off, not deletion', async () => {
      const { service, update } = makeService({
        remote: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: true,
          metadata: {},
        },
      });

      await service.resumeRenewal('org-1');

      expect(update).not.toHaveBeenCalled();
    });

    // The period ran out during the suspension. Restoring the organisation
    // must not quietly start charging again — they subscribe again instead.
    it('does not revive a subscription that ended during the suspension', async () => {
      const { service, update } = makeService({
        remote: {
          id: 'sub_1',
          status: 'canceled',
          cancel_at_period_end: true,
          metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: 'true' },
        },
      });

      await service.resumeRenewal('org-1');

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('cancelNow', () => {
    it('cancels the subscription outright', async () => {
      const { service, cancel } = makeService();

      await service.cancelNow('org-1');

      expect(cancel).toHaveBeenCalledWith('sub_1');
    });

    it('also cancels one whose renewal deletion had already stopped', async () => {
      const { service, cancel } = makeService({
        remote: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: true,
          metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: 'true' },
        },
      });

      await service.cancelNow('org-1');

      expect(cancel).toHaveBeenCalledWith('sub_1');
    });

    // A purge retried after an earlier attempt already cancelled.
    it('does nothing for a subscription that has already ended', async () => {
      const { service, cancel } = makeService({
        remote: {
          id: 'sub_1',
          status: 'canceled',
          cancel_at_period_end: false,
          metadata: {},
        },
      });

      await service.cancelNow('org-1');

      expect(cancel).not.toHaveBeenCalled();
    });

    it('treats a subscription that vanished before the cancel as done', async () => {
      const { service } = makeService({ cancelError: missing });

      await expect(service.cancelNow('org-1')).resolves.toBeUndefined();
    });

    // What keeps the purge from erasing the only record of the id while
    // the subscription is still live.
    it('throws when Stripe refuses or cannot be reached', async () => {
      const { service } = makeService({
        cancelError: new Error('ECONNRESET'),
      });

      await expect(service.cancelNow('org-1')).rejects.toThrow('ECONNRESET');
    });
  });
});
