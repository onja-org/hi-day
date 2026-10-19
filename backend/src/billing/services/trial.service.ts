import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../database/entities/subscription-status.enum';
import { EmailService } from '../../email/services/email.service';
import {
  dueTrialReminderDaysLeft,
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
}

@Injectable()
export class TrialService {
  private readonly logger = new Logger(TrialService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Starts the 14-day trial for a brand-new Organisation. Takes the caller's
   * `EntityManager` so it lands in the same transaction that creates the
   * Organisation — an org that exists without a trial would be an org nobody
   * can be told the state of.
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
    };
  }

  async getStatusOrThrow(organisationId: string): Promise<TrialStatus> {
    const status = await this.findStatus(organisationId);

    if (!status) {
      throw new NotFoundException(
        'This organisation is not on a trial. Contact support about a subscription.',
      );
    }

    return status;
  }

  /**
   * Hourly: email the owner as their trial nears its end. Hourly rather than
   * daily so a milestone is reached within an hour of being due regardless of
   * what time of day the organisation signed up.
   *
   * Only the owner is emailed — they are the one admin who can act on it (see
   * CONTEXT.md's Owner entry). Each organisation is handled independently so
   * one failure never blocks the rest, and the milestone is recorded only
   * after the email is handed off, so a crash mid-sweep retries rather than
   * silently skipping someone.
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
   * False when there is nobody to email — a suspended organisation (its owner
   * is mid-deletion and has bigger news) or one whose owner's User row is
   * gone. Returning false rather than recording the milestone leaves the
   * reminder due if the organisation is later restored.
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

    await this.emailService.sendTrialReminderEmail(
      organisation.owner.email,
      organisation.name,
      organisation.publicId,
      daysLeft,
    );

    return true;
  }
}
