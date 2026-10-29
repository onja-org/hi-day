import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../database/entities/subscription-status.enum';
import { EmailService } from '../../email/services/email.service';
import { billingRecipients } from '../billing-recipients';
import { parseFreeOrganisationIds } from '../free-organisations';
import {
  accessEndsAfter,
  dueTrialReminderDaysLeft,
  isInTrialGrace,
  isInGrace,
  isTrialExpired,
  trialDaysLeft,
  trialEndFrom,
} from '../trial';

/** What an admin is shown about their trial. */
export interface TrialStatus {
  status: SubscriptionStatus;
  /**
   * Whether a payment has ever succeeded. **The one flag the UI switches
   * on** — everything trial-shaped is hidden when it is true, rather than
   * each surface re-deciding from dates and reaching a different answer.
   */
  isPaid: boolean;
  /** ISO timestamps. History once paid, never behaviour. */
  trialStartedAt: string;
  trialEndsAt: string;
  /** When the trial actually stopped: the first payment. Null if still on one. */
  trialEndedAt: string | null;
  /** Rounded up; `0` only once the trial has actually run out. */
  daysLeft: number;
  /** Meaningless once paid, and not read there. */
  isExpired: boolean;
  /**
   * The trial has run out but access has not. Everything still works; the
   * banner hardens and names the date it stops.
   */
  isInGrace: boolean;
  /** ISO timestamp: when access stops, once enforcement exists. */
  accessEndsAt: string;
  /**
   * Set once they have paid: the end of the period paid for, which a
   * cancellation runs until and a renewal moves forward. Null while on
   * trial, and for an Organisation that never subscribed.
   */
  currentPeriodEnd: string | null;
  /**
   * The paid period has run out but access has not — the same grace the
   * trial gets, measured from `currentPeriodEnd`. See `docs/adr/0030-...`.
   */
  isInPaidGrace: boolean;
  /** `monthly` or `annual`, once they have chosen. Null while on trial. */
  billingPeriod: string | null;
  /**
   * Stripe's own word for how collection is going — `active`, `past_due`,
   * `canceled`. Deliberately separate from `status`: this is whether the
   * money is arriving, that is whether they are a paying customer at all.
   */
  stripeStatus: string | null;
}

@Injectable()
export class TrialService {
  private readonly logger = new Logger(TrialService.name);

  /**
   * Read once at startup: this is configuration, not data, and re-reading it
   * per request would only invite the two answers to differ mid-flight.
   * Changing it is a restart.
   */
  private readonly freeOrganisationIds: Set<number>;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.freeOrganisationIds = parseFreeOrganisationIds(
      configService.get<string>('BILLING_FREE_ORGANISATION_IDS'),
    );
  }

  /** Whether this Organisation never pays. See free-organisations.ts. */
  isFree(publicId: number): boolean {
    return this.freeOrganisationIds.has(publicId);
  }

  /**
   * Takes the caller's `EntityManager` so the trial lands in the same
   * transaction that creates the Organisation — one can't exist without the
   * other.
   */
  async startTrial(
    manager: EntityManager,
    organisationId: string,
    now: Date = new Date(),
  ): Promise<Subscription> {
    return manager.save(
      manager.create(Subscription, {
        organisationId,
        status: SubscriptionStatus.TRIALING,
        trialStartedAt: now,
        trialEndsAt: trialEndFrom(now),
        trialReminderSentAtDaysLeft: null,
      }),
    );
  }

  /**
   * Null for an Organisation created before trials existed: it was never on
   * one, so there is nothing to show and no banner to raise.
   */
  async findStatus(
    organisationId: string,
    now: Date = new Date(),
  ): Promise<TrialStatus | null> {
    const subscription = await this.subscriptions.findOne({
      where: { organisationId },
    });

    if (!subscription) {
      return null;
    }

    // Once they have paid, the paid period is what access hangs off — the
    // trial's own dates stay on the row as history, and reading them for
    // the banner would say "your trial ended" to somebody who is paying.
    const periodEnd = subscription.currentPeriodEnd;

    return {
      status: subscription.status,
      isPaid: subscription.status === SubscriptionStatus.ACTIVE,
      trialStartedAt: subscription.trialStartedAt.toISOString(),
      trialEndsAt: subscription.trialEndsAt.toISOString(),
      trialEndedAt: subscription.trialEndedAt
        ? subscription.trialEndedAt.toISOString()
        : null,
      daysLeft: trialDaysLeft(subscription.trialEndsAt, now),
      isExpired: isTrialExpired(subscription.trialEndsAt, now),
      isInGrace: isInTrialGrace(subscription.trialEndsAt, now),
      accessEndsAt: accessEndsAfter(
        periodEnd ?? subscription.trialEndsAt,
      ).toISOString(),
      currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
      isInPaidGrace: periodEnd ? isInGrace(periodEnd, now) : false,
      billingPeriod: subscription.billingPeriod,
      stripeStatus: subscription.stripeStatus,
    };
  }

  /**
   * Hourly rather than daily, so a milestone is reached within an hour of
   * being due whatever time the Organisation signed up. Only the owner is
   * emailed — the one admin who can act on it. Each Organisation is handled
   * independently, and the milestone is recorded only after the email is
   * handed off, so a crash mid-sweep retries rather than skipping someone.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendDueTrialReminders(): Promise<void> {
    const now = new Date();

    const candidates = await this.subscriptions.find({
      where: { status: SubscriptionStatus.TRIALING },
    });

    for (const subscription of candidates) {
      const daysLeft = dueTrialReminderDaysLeft(
        subscription.trialEndsAt,
        now,
        subscription.trialReminderSentAtDaysLeft,
      );

      if (daysLeft === null) continue;

      try {
        const sent = await this.sendReminder(subscription, daysLeft);
        if (sent) {
          await this.subscriptions.update(subscription.id, {
            trialReminderSentAtDaysLeft: daysLeft,
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to send trial reminder for subscription ${subscription.id}: ${String(error)}`,
        );
      }
    }
  }

  /**
   * False when there is nobody to email: a suspended Organisation, or one
   * whose owner's User row is gone. Not recording the milestone leaves the
   * reminder due if it is later restored.
   */
  private async sendReminder(
    subscription: Subscription,
    daysLeft: number,
  ): Promise<boolean> {
    const organisation = await this.organisations.findOne({
      where: { id: subscription.organisationId, suspendedAt: IsNull() },
      relations: { owner: true },
    });

    // The billing address can carry it alone where the owner's User row has
    // been erased; with neither there is nobody to tell.
    const recipients = billingRecipients(
      organisation?.billingEmail ?? null,
      organisation?.owner?.email ?? null,
    );
    if (!organisation || recipients.length === 0) {
      return false;
    }

    // An Organisation that never pays has nothing running out, so telling its
    // owner their trial is nearly up would be false. Checked here rather than
    // in the sweep's query because the list is config, not a column.
    if (this.isFree(organisation.publicId)) {
      return false;
    }

    await this.emailService.sendTrialReminderEmail(
      recipients,
      organisation.name,
      daysLeft,
      accessEndsAfter(subscription.trialEndsAt).toDateString(),
    );

    return true;
  }
}
