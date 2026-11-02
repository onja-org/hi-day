import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { Organisation } from '../../../database/entities/organisation.entity';
import { Subscription } from '../../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../../database/entities/subscription-status.enum';
import { EmailService } from '../../../email/services/email.service';
import { BILLING_ENABLED_VAR } from '../../../entitlements/billing-enabled';
import { StripeService } from '../stripe.service';
import { TrialService } from '../trial.service';

/**
 * The self-hosted half of every billing behaviour: what `BILLING_ENABLED=false`
 * actually changes.
 *
 * Each case here has a paying counterpart in trial.service.spec.ts or
 * stripe.service.spec.ts — the point of the pair is that one build does both,
 * which is the whole argument for a flag over a stripped-down fork.
 */

const NOW = new Date('2026-01-01T09:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function trialServiceWith(
  billingEnabled: string | undefined,
  trialingRows: Subscription[] = [],
) {
  const find = jest.fn().mockResolvedValue(trialingRows);
  const update = jest.fn().mockResolvedValue(undefined);
  const sendTrialReminderEmail = jest.fn().mockResolvedValue(undefined);

  const service = new TrialService(
    { find, update, findOne: jest.fn() } as unknown as Repository<Subscription>,
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'org-1',
        publicId: 100001,
        name: 'Acme Inc',
        billingEmail: null,
        owner: { email: 'owner@acme.test' },
      }),
    } as unknown as Repository<Organisation>,
    { sendTrialReminderEmail } as unknown as EmailService,
    configWith({ [BILLING_ENABLED_VAR]: billingEnabled }),
  );

  return { service, find, update, sendTrialReminderEmail };
}

function trialEndingIn(daysFromNow: number): Subscription {
  return {
    id: 'sub-1',
    organisationId: 'org-1',
    status: SubscriptionStatus.TRIALING,
    trialStartedAt: new Date(NOW.getTime() - 13 * MS_PER_DAY),
    trialEndsAt: new Date(NOW.getTime() + daysFromNow * MS_PER_DAY),
    trialReminderSentAtDaysLeft: null,
  } as Subscription;
}

describe('starting a trial with billing off', () => {
  function recordingManager() {
    const create = jest.fn((_entity: unknown, data: unknown) => data);
    const save = jest.fn((data: unknown) => Promise.resolve(data));
    return {
      manager: { create, save } as unknown as EntityManager,
      create,
      save,
    };
  }

  /**
   * No row at all, rather than a `trialing` row behind a hidden UI. "No
   * Subscription" is already how an Organisation that was never on a trial is
   * spelled, and the banner and the reminder sweep both read it as nothing to
   * say — so self-hosted gets the right behaviour from existing code.
   */
  it('writes no Subscription row', async () => {
    const { service } = trialServiceWith(undefined);
    const { manager, create, save } = recordingManager();

    await expect(service.startTrial(manager, 'org-1', NOW)).resolves.toBeNull();

    expect(create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('still writes one with billing on', async () => {
    const { service } = trialServiceWith('true');
    const { manager, save } = recordingManager();

    await expect(
      service.startTrial(manager, 'org-1', NOW),
    ).resolves.not.toBeNull();

    expect(save).toHaveBeenCalled();
  });
});

describe('the trial reminder sweep with billing off', () => {
  /**
   * Stopped before the query, not just before the send. An install that once
   * ran with billing on still has `trialing` rows, and turning the flag off
   * has to stop the emails that hour rather than whenever those rows go.
   */
  it('emails nobody, and does not even look for candidates', async () => {
    const { service, find, sendTrialReminderEmail } = trialServiceWith(
      undefined,
      [trialEndingIn(1)],
    );

    await service.sendDueTrialReminders();

    expect(find).not.toHaveBeenCalled();
    expect(sendTrialReminderEmail).not.toHaveBeenCalled();
  });

  it('emails the owner with billing on', async () => {
    const { service, find, sendTrialReminderEmail } = trialServiceWith('true', [
      trialEndingIn(1),
    ]);
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      await service.sendDueTrialReminders();
    } finally {
      jest.useRealTimers();
    }

    expect(find).toHaveBeenCalled();
    expect(sendTrialReminderEmail).toHaveBeenCalled();
  });
});

describe('Stripe configuration across the two modes', () => {
  /** The keys are not required, which is the acceptance criterion. */
  it('boots with no payment provider config at all', () => {
    const service = new StripeService(configWith({}));

    expect(service.isConfigured).toBe(false);
  });

  /**
   * The flag is the decision; a key is only the means. A leftover key in an
   * environment must not switch billing back on behind the flag's back.
   */
  it('stays off even where a stray secret key is set', () => {
    const service = new StripeService(
      configWith({ STRIPE_SECRET_KEY: 'sk_test_leftover' }),
    );

    expect(service.isConfigured).toBe(false);
  });

  it('asking for the client with billing off is a programming error', () => {
    const service = new StripeService(configWith({}));

    expect(() => service.stripe).toThrow(/not configured/i);
  });

  /**
   * The one combination that refuses to boot. It used to degrade quietly:
   * seat syncs became no-ops and admins saw an "Add payment" button leading
   * nowhere, on a Cloud deploy that looked healthy.
   */
  it('refuses to start when billing is on without a secret key', () => {
    expect(
      () => new StripeService(configWith({ [BILLING_ENABLED_VAR]: 'true' })),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('is configured when the flag and the key agree', () => {
    const service = new StripeService(
      configWith({
        [BILLING_ENABLED_VAR]: 'true',
        STRIPE_SECRET_KEY: 'sk_test',
      }),
    );

    expect(service.isConfigured).toBe(true);
  });
});
