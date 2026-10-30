import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../database/entities/subscription-status.enum';
import { stripeSaysPaid } from '../stripe-paid-status';
import { StripeService } from './stripe.service';

/**
 * Catches an Organisation that paid while we were not listening.
 *
 * The webhook is the *authority* on a payment (`docs/adr/0031-...`), and it
 * should not also be the only *chance*: a delivery that fails past Stripe's
 * three days of retries, an endpoint missing the `invoice.paid` event, or a
 * local machine with no `stripe listen` running all leave an Organisation
 * charged by Stripe and trialing here — with a countdown banner and
 * "your trial ends soon" emails going to somebody who has paid.
 *
 * So the billing page asks Stripe directly before answering. Narrow on
 * purpose: only for a row that still says `trialing` *and* already carries
 * a Stripe subscription id, which is a state that should not exist and is
 * rare enough to afford a round trip. Everyone else — every real trial,
 * every already-active subscription — costs nothing.
 *
 * Never throws. Reconciling is a repair, and a repair that fails must not
 * take the billing page down with it.
 */
@Injectable()
export class SubscriptionReconcilerService {
  private readonly logger = new Logger(SubscriptionReconcilerService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Returns whether anything was repaired, so the caller can re-read. The
   * write is the same `trialing` → `active` transition the webhook makes,
   * and is equally idempotent: a second call finds the row active and stops
   * at the guard below.
   */
  async reconcile(organisationId: string): Promise<boolean> {
    if (!this.stripeService.isConfigured) return false;

    const subscription = await this.subscriptions.findOne({
      where: { organisationId },
    });

    // The only shape worth a round trip: says trialing, has a Stripe
    // subscription. A trial that never reached checkout has no id, and an
    // active row has nothing to repair.
    if (
      !subscription ||
      subscription.status !== SubscriptionStatus.TRIALING ||
      !subscription.stripeSubscriptionId
    ) {
      return false;
    }

    try {
      const remote = await this.stripeService.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );
      if (!stripeSaysPaid(remote.status)) return false;

      await this.subscriptions.update(subscription.id, {
        status: SubscriptionStatus.ACTIVE,
        // Stripe knows when the payment happened; `start_date` is when the
        // subscription began, which for us is the same moment — we hand it
        // no trial. Falling back to now rather than guessing.
        trialEndedAt: remote.start_date
          ? new Date(remote.start_date * 1000)
          : new Date(),
        stripeStatus: remote.status,
      });

      this.logger.warn(
        `Organisation ${organisationId} was paid in Stripe but trialing here; repaired on read. A webhook was missed.`,
      );
      return true;
    } catch (error) {
      // Stripe unreachable, or an id that no longer resolves. The page still
      // answers, from the record we have.
      this.logger.error(
        `Could not reconcile organisation ${organisationId}: ${String(error)}`,
      );
      return false;
    }
  }
}
