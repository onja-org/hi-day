import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Subscription } from '../../database/entities/subscription.entity';
import { isStripeMissing } from '../stripe-missing';
import { hasEnded } from '../stripe-subscription-states';
import { StripeService } from './stripe.service';

/**
 * Set on a Stripe subscription whose renewal *deletion* switched off, so a
 * restore turns back on only what deletion turned off. A customer who had
 * already cancelled auto-renew themselves keeps it cancelled after a
 * restore. Lives in Stripe, beside the renewal state it describes
 * (`docs/adr/0032-...`), rather than in a column of ours.
 */
export const RENEWAL_STOPPED_BY_DELETION_KEY = 'renewalStoppedByDeletion';

/**
 * Stops an Organisation being charged once its owner deletes it — see
 * `docs/adr/0034-...`. Suspension stops renewal (reversible, undone by a
 * restore); the purge cancels outright before erasing the ids that are our
 * only way back to the subscription.
 *
 * Every method is idempotent and a no-op for an Organisation with no
 * Stripe subscription (every trial, every free-by-config Organisation), so
 * callers never need to ask first.
 */
@Injectable()
export class SubscriptionCancellationService {
  private readonly logger = new Logger(SubscriptionCancellationService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * On suspension: no further renewal, but the period already paid for runs
   * out as normal and the subscription can still be resumed. Leaves alone a
   * subscription that already will not renew, without marking it — that was
   * the customer's choice, not deletion's.
   */
  async stopRenewal(organisationId: string): Promise<void> {
    const remote = await this.remote(organisationId);
    if (!remote || hasEnded(remote.status)) return;
    if (remote.cancel_at_period_end) return;

    await this.stripeService.stripe.subscriptions.update(remote.id, {
      cancel_at_period_end: true,
      metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: 'true' },
    });
    this.logger.log(
      `Stopped renewal of ${remote.id} for suspended organisation ${organisationId}.`,
    );
  }

  /**
   * On restore: renews again, but only where deletion was what stopped it.
   * A subscription whose period ran out during the suspension has ended for
   * good; restoring the Organisation does not restart billing behind the
   * owner's back — they subscribe again from the Billing page.
   */
  async resumeRenewal(organisationId: string): Promise<void> {
    const remote = await this.remote(organisationId);
    if (!remote) return;
    if (remote.metadata?.[RENEWAL_STOPPED_BY_DELETION_KEY] !== 'true') return;
    if (hasEnded(remote.status)) return;

    await this.stripeService.stripe.subscriptions.update(remote.id, {
      cancel_at_period_end: false,
      // An empty string is how Stripe deletes a metadata key.
      metadata: { [RENEWAL_STOPPED_BY_DELETION_KEY]: '' },
    });
    this.logger.log(
      `Resumed renewal of ${remote.id} for restored organisation ${organisationId}.`,
    );
  }

  /**
   * Before the purge: ends the subscription now. Throws if Stripe cannot be
   * reached, which aborts the purge — keeping our row, and with it the only
   * record of the subscription id, until it can be cancelled.
   *
   * No proration credit and no final invoice (Stripe's defaults): the owner
   * chose to delete, and what they already paid for is not refunded.
   */
  async cancelNow(organisationId: string): Promise<void> {
    const remote = await this.remote(organisationId);
    if (!remote || hasEnded(remote.status)) return;

    try {
      await this.stripeService.stripe.subscriptions.cancel(remote.id);
    } catch (error) {
      // Gone between the read and the cancel: the outcome we wanted.
      if (isStripeMissing(error)) return;
      throw error;
    }
    this.logger.log(
      `Cancelled ${remote.id} before purging organisation ${organisationId}.`,
    );
  }

  /** Null when there is nothing in Stripe to act on. Other errors throw. */
  private async remote(
    organisationId: string,
  ): Promise<Stripe.Subscription | null> {
    const row = await this.subscriptions.findOne({ where: { organisationId } });
    if (!row?.stripeSubscriptionId) return null;

    try {
      return await this.stripeService.stripe.subscriptions.retrieve(
        row.stripeSubscriptionId,
      );
    } catch (error) {
      // Deleted in Stripe's dashboard, or a test-mode object wiped: nothing
      // left that could charge anybody.
      if (isStripeMissing(error)) return null;
      throw error;
    }
  }
}
