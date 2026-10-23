import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { Organisation } from '../../../database/entities/organisation.entity';
import { Subscription } from '../../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../../database/entities/subscription-status.enum';
import { EmailService } from '../../../email/services/email.service';
import { TRIAL_DAYS } from '../../trial';
import { TrialService } from '../trial.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-01T09:00:00.000Z');

function makeSubscriptionsRepo(
  overrides: Partial<Repository<Subscription>> = {},
) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Repository<Subscription>;
}

function makeOrganisationsRepo(organisation: unknown) {
  return {
    findOne: jest.fn().mockResolvedValue(organisation),
  } as unknown as Repository<Organisation>;
}

function makeEmailService() {
  const sendTrialReminderEmail = jest.fn().mockResolvedValue(undefined);
  return {
    emailService: { sendTrialReminderEmail } as unknown as EmailService,
    sendTrialReminderEmail,
  };
}

/** Config with the given organisations listed as never paying. */
function makeConfig(freeIds: number[] = []): ConfigService {
  return {
    get: () => (freeIds.length > 0 ? freeIds.join(',') : undefined),
  } as unknown as ConfigService;
}

/** A trialling subscription whose trial ends `daysFromNow` days from NOW. */
function subscriptionEndingIn(
  daysFromNow: number,
  trialReminderSentAtDaysLeft: number | null = null,
): Subscription {
  return {
    id: 'sub-1',
    organisationId: 'org-1',
    status: SubscriptionStatus.TRIALING,
    trialStartedAt: new Date(NOW.getTime() - 11 * MS_PER_DAY),
    trialEndsAt: new Date(NOW.getTime() + daysFromNow * MS_PER_DAY),
    trialReminderSentAtDaysLeft,
  } as Subscription;
}

const ACTIVE_ORGANISATION = {
  id: 'org-1',
  publicId: 100001,
  name: 'Acme Inc',
  owner: { email: 'owner@acme.test' },
};

describe('TrialService', () => {
  describe('startTrial', () => {
    it('starts a 14-day trial on the caller’s transaction', async () => {
      const created: Partial<Subscription>[] = [];
      const manager = {
        create: jest.fn((_entity: unknown, data: Partial<Subscription>) => {
          created.push(data);
          return data;
        }),
        save: jest.fn((data: unknown) => Promise.resolve(data)),
      } as unknown as EntityManager;
      const service = new TrialService(
        makeSubscriptionsRepo(),
        makeOrganisationsRepo(null),
        makeEmailService().emailService,
        makeConfig(),
      );

      await service.startTrial(manager, 'org-1', NOW);

      expect(created[0]).toMatchObject({
        organisationId: 'org-1',
        status: SubscriptionStatus.TRIALING,
        trialStartedAt: NOW,
        trialReminderSentAtDaysLeft: null,
      });
      expect(created[0].trialEndsAt!.getTime() - NOW.getTime()).toBe(
        TRIAL_DAYS * MS_PER_DAY,
      );
    });
  });

  describe('findStatus', () => {
    it('is null for an organisation that was never on a trial', async () => {
      const service = new TrialService(
        makeSubscriptionsRepo(),
        makeOrganisationsRepo(null),
        makeEmailService().emailService,
        makeConfig(),
      );

      await expect(service.findStatus('org-1', NOW)).resolves.toBeNull();
    });

    it('reports days left and expiry for a running trial', async () => {
      const service = new TrialService(
        makeSubscriptionsRepo({
          findOne: jest.fn().mockResolvedValue(subscriptionEndingIn(2.5)),
        }),
        makeOrganisationsRepo(null),
        makeEmailService().emailService,
        makeConfig(),
      );

      await expect(service.findStatus('org-1', NOW)).resolves.toMatchObject({
        daysLeft: 3,
        isExpired: false,
      });
    });
  });

  describe('free organisations', () => {
    it('knows which organisations never pay, by publicId', () => {
      const service = new TrialService(
        makeSubscriptionsRepo(),
        makeOrganisationsRepo(null),
        makeEmailService().emailService,
        makeConfig([100001, 100042]),
      );

      expect(service.isFree(100001)).toBe(true);
      expect(service.isFree(100042)).toBe(true);
      expect(service.isFree(100099)).toBe(false);
    });

    it('never emails one about a trial running out', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const { emailService, sendTrialReminderEmail } = makeEmailService();
      const service = new TrialService(
        makeSubscriptionsRepo({
          find: jest.fn().mockResolvedValue([subscriptionEndingIn(2.5)]),
          update,
        }),
        makeOrganisationsRepo(ACTIVE_ORGANISATION),
        emailService,
        // ACTIVE_ORGANISATION's publicId.
        makeConfig([100001]),
      );

      await service.sendDueTrialReminders();

      expect(sendTrialReminderEmail).not.toHaveBeenCalled();
      // The milestone stays unspent: if the organisation is ever taken off
      // the list, the reminder it was owed is still due.
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('sendDueTrialReminders', () => {
    jest.useFakeTimers();

    beforeEach(() => {
      jest.setSystemTime(NOW);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    function serviceFor(subscriptions: Subscription[], organisation: unknown) {
      const update = jest.fn().mockResolvedValue(undefined);
      const { emailService, sendTrialReminderEmail } = makeEmailService();
      const service = new TrialService(
        makeSubscriptionsRepo({
          find: jest.fn().mockResolvedValue(subscriptions),
          update,
        }),
        makeOrganisationsRepo(organisation),
        emailService,
        makeConfig(),
      );
      return { service, update, sendTrialReminderEmail };
    }

    it('emails only the owner, and records the milestone', async () => {
      const { service, update, sendTrialReminderEmail } = serviceFor(
        [subscriptionEndingIn(2.5)],
        ACTIVE_ORGANISATION,
      );

      await service.sendDueTrialReminders();

      expect(sendTrialReminderEmail).toHaveBeenCalledTimes(1);
      expect(sendTrialReminderEmail).toHaveBeenCalledWith(
        'owner@acme.test',
        'Acme Inc',
        3,
        expect.any(String),
      );
      expect(update).toHaveBeenCalledWith('sub-1', {
        trialReminderSentAtDaysLeft: 3,
      });
    });

    it('leaves the milestone due when the organisation is suspended', async () => {
      // The repository filters suspended organisations out, so it finds none.
      const { service, update, sendTrialReminderEmail } = serviceFor(
        [subscriptionEndingIn(2.5)],
        null,
      );

      await service.sendDueTrialReminders();

      expect(sendTrialReminderEmail).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('keeps going when one organisation fails', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const sendTrialReminderEmail = jest
        .fn()
        .mockRejectedValueOnce(new Error('resend is down'))
        .mockResolvedValue(undefined);
      const service = new TrialService(
        makeSubscriptionsRepo({
          find: jest.fn().mockResolvedValue([
            { ...subscriptionEndingIn(2.5), id: 'sub-1' },
            { ...subscriptionEndingIn(2.5), id: 'sub-2' },
          ]),
          update,
        }),
        makeOrganisationsRepo(ACTIVE_ORGANISATION),
        { sendTrialReminderEmail } as unknown as EmailService,
        makeConfig(),
      );

      await service.sendDueTrialReminders();

      expect(sendTrialReminderEmail).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith('sub-2', {
        trialReminderSentAtDaysLeft: 3,
      });
    });
  });
});
