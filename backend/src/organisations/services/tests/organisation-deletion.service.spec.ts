import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SubscriptionCancellationService } from '../../../billing/services/subscription-cancellation.service';
import { hashToken } from '../../../common/hash-token.util';
import { OrganisationDeletionMode } from '../../../database/entities/organisation-deletion-request.entity';
import { EmailService } from '../../../email/services/email.service';
import { OrganisationDeletionService } from '../organisation-deletion.service';
import { OrganisationPurgeService } from '../organisation-purge.service';

const OWNER = 'user-owner';

function updateChanges(manager: { update: jest.Mock }, call: number): unknown {
  return (manager.update.mock.calls[call] as unknown[])[2];
}

function makeService(
  organisation: Record<string, unknown>,
  request: Record<string, unknown> | null = null,
  {
    otherMemberships = 0,
    billing,
    suspendedOrganisations = [],
  }: {
    otherMemberships?: number;
    /** Omitted = billing off, as on a self-hosted install. */
    billing?: { stopRenewal: jest.Mock; resumeRenewal: jest.Mock };
    /** What the hourly job's "every suspended organisation" query finds. */
    suspendedOrganisations?: Record<string, unknown>[];
  } = {},
) {
  const manager = {
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((_: unknown, data: unknown) => data),
    update: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
  } as unknown as DataSource;
  const email = {
    sendOrganisationDeletionConfirmationEmail: jest.fn(),
    sendOrganisationDeletionNotice: jest.fn(),
  };
  const record = jest.fn();
  const purge = jest.fn().mockResolvedValue(undefined);
  const memberships = {
    findOneOrFail: jest
      .fn()
      .mockResolvedValue({ user: { email: 'owner@acme.test' } }),
    find: jest.fn().mockResolvedValue([{ user: { email: 'a@acme.test' } }]),
    count: jest.fn().mockResolvedValue(otherMemberships),
  };
  const service = new OrganisationDeletionService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'org-1',
        publicId: 100001,
        name: 'Acme',
        ownerUserId: OWNER,
        deletionScheduledFor: null,
        suspendedAt: null,
        purgeAt: null,
        ...organisation,
      }),
      // Only the suspended-organisations sweep filters on both columns;
      // nothing is due for suspension or purge in these tests.
      find: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          'suspendedAt' in where && 'purgeAt' in where
            ? suspendedOrganisations
            : [],
        ),
      ),
    } as never,
    memberships as never,
    {} as never,
    {
      findOne: jest.fn().mockResolvedValue(request),
      delete: jest.fn(),
    } as never,
    dataSource,
    { record },
    email as unknown as EmailService,
    { purge } as unknown as OrganisationPurgeService,
    {
      get: (_: string, fallback: string) => fallback,
    } as unknown as ConfigService,
    billing as unknown as SubscriptionCancellationService | undefined,
  );
  return { service, manager, email, record, purge, memberships };
}

function makeBilling() {
  return {
    stopRenewal: jest.fn().mockResolvedValue(undefined),
    resumeRenewal: jest.fn().mockResolvedValue(undefined),
  };
}

describe('OrganisationDeletionService', () => {
  describe('requestDeletion', () => {
    it('rejects anyone but the owner', async () => {
      const { service } = makeService({});
      await expect(
        service.requestDeletion('org-1', 'someone-else', {
          mode: OrganisationDeletionMode.NOW,
          confirmName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a confirmation name that does not match exactly', async () => {
      const { service } = makeService({});
      await expect(
        service.requestDeletion('org-1', OWNER, {
          mode: OrganisationDeletionMode.NOW,
          confirmName: 'acme',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a scheduled date in the past', async () => {
      const { service } = makeService({});
      await expect(
        service.requestDeletion('org-1', OWNER, {
          mode: OrganisationDeletionMode.SCHEDULED,
          scheduledFor: new Date(Date.now() - 1000).toISOString(),
          confirmName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when deletion is already in progress', async () => {
      const { service } = makeService({ suspendedAt: new Date() });
      await expect(
        service.requestDeletion('org-1', OWNER, {
          mode: OrganisationDeletionMode.NOW,
          confirmName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects every mode once the organisation is purging', async () => {
      const { service } = makeService({
        suspendedAt: new Date(Date.now() - 1000),
        purgeAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.requestDeletion('org-1', OWNER, {
          mode: OrganisationDeletionMode.PERMANENT,
          confirmName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      [
        'scheduled',
        { deletionScheduledFor: new Date(Date.now() + 86_400_000) },
      ],
      [
        'suspended',
        {
          suspendedAt: new Date(),
          purgeAt: new Date(Date.now() + 86_400_000),
        },
      ],
    ])(
      'accepts a permanent request while %s',
      async (_, organisation: Record<string, unknown>) => {
        const { service, email } = makeService(organisation);
        await service.requestDeletion('org-1', OWNER, {
          mode: OrganisationDeletionMode.PERMANENT,
          confirmName: 'Acme',
        });
        expect(
          email.sendOrganisationDeletionConfirmationEmail,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it('emails a confirmation link and changes nothing on the organisation', async () => {
      const { service, manager, email } = makeService({});
      await service.requestDeletion('org-1', OWNER, {
        mode: OrganisationDeletionMode.NOW,
        confirmName: 'Acme',
      });
      expect(
        email.sendOrganisationDeletionConfirmationEmail,
      ).toHaveBeenCalledTimes(1);
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmDeletion', () => {
    const validRequest = {
      requestedByUserId: OWNER,
      mode: OrganisationDeletionMode.NOW,
      scheduledFor: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashToken('t'),
    };

    it('rejects an unknown token', async () => {
      const { service } = makeService({}, null);
      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired token', async () => {
      const { service } = makeService(
        {},
        {
          ...validRequest,
          expiresAt: new Date(Date.now() - 1000),
        },
      );
      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('suspends immediately for "now", stopping timers and revoking sessions', async () => {
      const { service, manager, record } = makeService({}, validRequest);
      await service.confirmDeletion('org-1', OWNER, 't');
      const updatedTargets = manager.update.mock.calls.map(
        (call: [{ name?: string }]) => call[0].name,
      );
      expect(updatedTargets).toEqual(
        expect.arrayContaining([
          'Organisation',
          'TimeEntryPause',
          'TimeEntry',
          'DeviceSession',
        ]),
      );
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'organisation.suspended' }),
      );
    });

    it('only records the date for "scheduled" without suspending', async () => {
      const scheduledFor = new Date(Date.now() + 86_400_000);
      const { service, manager, record } = makeService(
        {},
        {
          ...validRequest,
          mode: OrganisationDeletionMode.SCHEDULED,
          scheduledFor,
        },
      );
      await service.confirmDeletion('org-1', OWNER, 't');
      expect(manager.update).toHaveBeenCalledTimes(1);
      expect(updateChanges(manager, 0)).toEqual({
        deletionScheduledFor: scheduledFor,
      });
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'organisation.deletion_scheduled' }),
      );
    });
  });

  describe('confirmDeletion — permanent', () => {
    const permanentRequest = {
      requestedByUserId: OWNER,
      mode: OrganisationDeletionMode.PERMANENT,
      scheduledFor: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashToken('t'),
    };

    it('suspends with purgeAt now and starts the purge without a restorable notice', async () => {
      const { service, manager, record, email, purge } = makeService(
        {},
        permanentRequest,
      );
      await service.confirmDeletion('org-1', OWNER, 't');
      const changes = updateChanges(manager, 0) as {
        suspendedAt: Date;
        purgeAt: Date;
      };
      expect(changes.purgeAt).toEqual(changes.suspendedAt);
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'organisation.suspended' }),
      );
      expect(purge).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'org-1' }),
      );
      expect(email.sendOrganisationDeletionNotice).not.toHaveBeenCalled();
    });

    it('ends a suspended organisation’s recovery window early and audits it', async () => {
      const previousPurgeAt = new Date(Date.now() + 10 * 86_400_000);
      const { service, manager, record, purge } = makeService(
        { suspendedAt: new Date(), purgeAt: previousPurgeAt },
        permanentRequest,
      );
      await service.confirmDeletion('org-1', OWNER, 't');
      expect(manager.update).toHaveBeenCalledTimes(1);
      expect(Object.keys(updateChanges(manager, 0) as object)).toEqual([
        'purgeAt',
      ]);
      const audit = (record.mock.calls[0] as unknown[])[1] as {
        action: string;
        metadata: { previousPurgeAt: string };
      };
      expect(audit.action).toBe('organisation.purge_expedited');
      expect(audit.metadata.previousPurgeAt).toBe(
        previousPurgeAt.toISOString(),
      );
      expect(purge).toHaveBeenCalledTimes(1);
    });

    it('signs the owner out when this was their only organisation', async () => {
      const { service } = makeService({}, permanentRequest);
      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).resolves.toEqual(expect.objectContaining({ signedOut: true }));
    });

    it('only counts an active membership elsewhere when deciding to sign out', async () => {
      const { service, memberships } = makeService({}, permanentRequest, {
        otherMemberships: 1,
      });
      await service.confirmDeletion('org-1', OWNER, 't');
      expect(memberships.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: 'active' }) as unknown,
      });
    });

    it('keeps the owner signed in when they belong to another organisation', async () => {
      const { service } = makeService({}, permanentRequest, {
        otherMemberships: 1,
      });
      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).resolves.toEqual(expect.objectContaining({ signedOut: false }));
    });

    it('still succeeds when the purge fails, leaving it for the hourly retry', async () => {
      const { service, purge } = makeService({}, permanentRequest);
      purge.mockRejectedValue(new Error('wasabi down'));
      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).resolves.toEqual(expect.objectContaining({ signedOut: true }));
    });
  });

  describe('cancelDeletion', () => {
    it('refuses once the organisation is purging', async () => {
      const { service, manager } = makeService({
        suspendedAt: new Date(Date.now() - 1000),
        purgeAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.cancelDeletion('org-1', OWNER),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('restores a suspended organisation and audits it', async () => {
      const { service, manager, record } = makeService({
        suspendedAt: new Date(),
        purgeAt: new Date(Date.now() + 86_400_000),
      });
      await service.cancelDeletion('org-1', OWNER);
      expect(updateChanges(manager, 0)).toEqual({
        deletionScheduledFor: null,
        suspendedAt: null,
        purgeAt: null,
      });
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'organisation.deletion_cancelled' }),
      );
    });

    it('rejects anyone but the owner', async () => {
      const { service } = makeService({ suspendedAt: new Date() });
      await expect(
        service.cancelDeletion('org-1', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  /**
   * A deleted organisation must stop being charged: renewal stops when
   * access stops, and comes back if the owner restores it. The purge's own
   * outright cancellation is covered in the purge spec.
   */
  describe('billing', () => {
    const nowRequest = {
      requestedByUserId: OWNER,
      mode: OrganisationDeletionMode.NOW,
      scheduledFor: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashToken('t'),
    };
    const suspended = {
      suspendedAt: new Date(),
      purgeAt: new Date(Date.now() + 86_400_000),
    };

    it('stops renewal when "now" suspends the organisation', async () => {
      const billing = makeBilling();
      const { service } = makeService({}, nowRequest, { billing });

      await service.confirmDeletion('org-1', OWNER, 't');

      expect(billing.stopRenewal).toHaveBeenCalledWith('org-1');
    });

    // The suspension is what the owner asked for and has already happened;
    // the hourly job retries the billing half.
    it('still suspends when Stripe cannot be reached', async () => {
      const billing = makeBilling();
      billing.stopRenewal.mockRejectedValue(new Error('Stripe is down'));
      const { service, manager } = makeService({}, nowRequest, { billing });

      await expect(
        service.confirmDeletion('org-1', OWNER, 't'),
      ).resolves.toEqual(expect.objectContaining({ signedOut: false }));
      expect(
        (updateChanges(manager, 0) as { suspendedAt: unknown }).suspendedAt,
      ).toBeInstanceOf(Date);
    });

    // Nothing is suspended yet, so the organisation is still in use and
    // still paid for.
    it('leaves billing alone when deletion is only scheduled', async () => {
      const billing = makeBilling();
      const { service } = makeService(
        {},
        {
          ...nowRequest,
          mode: OrganisationDeletionMode.SCHEDULED,
          scheduledFor: new Date(Date.now() + 86_400_000),
        },
        { billing },
      );

      await service.confirmDeletion('org-1', OWNER, 't');

      expect(billing.stopRenewal).not.toHaveBeenCalled();
    });

    it('resumes renewal when a suspended organisation is restored', async () => {
      const billing = makeBilling();
      const { service, manager } = makeService(suspended, null, { billing });

      await service.cancelDeletion('org-1', OWNER);

      expect(billing.resumeRenewal).toHaveBeenCalledWith('org-1');
      expect(updateChanges(manager, 0)).toEqual(
        expect.objectContaining({ suspendedAt: null }),
      );
    });

    // Restoring with renewal still off would cut the organisation off again
    // at the period end, weeks later, with nothing to say why.
    it('refuses to restore, changing nothing, when Stripe cannot be reached', async () => {
      const billing = makeBilling();
      billing.resumeRenewal.mockRejectedValue(new Error('Stripe is down'));
      const { service, manager } = makeService(suspended, null, { billing });

      await expect(
        service.cancelDeletion('org-1', OWNER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('does not touch billing when cancelling a schedule that never suspended', async () => {
      const billing = makeBilling();
      const { service } = makeService(
        { deletionScheduledFor: new Date(Date.now() + 86_400_000) },
        null,
        { billing },
      );

      await service.cancelDeletion('org-1', OWNER);

      expect(billing.resumeRenewal).not.toHaveBeenCalled();
    });

    // Catches anything Stripe was unreachable for at suspension time.
    it('stops renewal for every suspended organisation each hour, one failure not blocking the rest', async () => {
      const billing = makeBilling();
      billing.stopRenewal
        .mockRejectedValueOnce(new Error('Stripe is down'))
        .mockResolvedValue(undefined);
      const { service } = makeService({}, null, {
        billing,
        suspendedOrganisations: [
          { id: 'org-a', publicId: 1 },
          { id: 'org-b', publicId: 2 },
        ],
      });

      await service.processDueDeletions();

      expect(billing.stopRenewal).toHaveBeenCalledWith('org-a');
      expect(billing.stopRenewal).toHaveBeenCalledWith('org-b');
    });

    it('works unchanged with billing off', async () => {
      const { service, manager } = makeService(suspended);

      await service.cancelDeletion('org-1', OWNER);

      expect(updateChanges(manager, 0)).toEqual(
        expect.objectContaining({ suspendedAt: null }),
      );
    });
  });
});
