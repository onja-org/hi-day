import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../database/entities/subscription-status.enum';
import { EmailService } from '../../email/services/email.service';
import { parseFreeOrganisationIds } from '../free-organisations';
import {
  accessEndsAfter,
  dueTrialReminderDaysLeft,
  isInTrialGrace,
  isTrialExpired,
  trialDaysLeft,
  trialEndFrom,
} from '../trial';

/** What an admin is shown about their trial. */
export interface TrialStatus {
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  /** Rounded up; `0` only once the trial has actually run out. */
  daysLeft: number;
  /** Nothing is blocked by this yet — see CONTEXT.md's Trial entry. */
  isExpired: boolean;
  /**
   * The trial has run out but access has not. Everything still works; the
   * banner hardens and names the date it stops.
   */
  isInGrace: boolean;
  /** ISO timestamp: when access stops, once enforcement exists. */
  accessEndsAt: string;
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

    return {
      status: subscription.status,
      trialStartedAt: subscription.trialStartedAt.toISOString(),
      trialEndsAt: subscription.trialEndsAt.toISOString(),
      daysLeft: trialDaysLeft(subscription.trialEndsAt, now),
      isExpired: isTrialExpired(subscription.trialEndsAt, now),
      isInGrace: isInTrialGrace(subscription.trialEndsAt, now),
      accessEndsAt: accessEndsAfter(subscription.trialEndsAt).toISOString(),
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

    if (!organisation?.owner) {
      return false;
    }

    // An Organisation that never pays has nothing running out, so telling its
    // owner their trial is nearly up would be false. Checked here rather than
    // in the sweep's query because the list is config, not a column.
    if (this.isFree(organisation.publicId)) {
      return false;
    }

    await this.emailService.sendTrialReminderEmail(
      organisation.owner.email,
      organisation.name,
      daysLeft,
      accessEndsAfter(subscription.trialEndsAt).toDateString(),
    );

    return true;
  }
}
