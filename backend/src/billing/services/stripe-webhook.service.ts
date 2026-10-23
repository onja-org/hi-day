import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type Stripe from 'stripe';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { ORGANISATION_METADATA_KEY } from './checkout.service';
import { StripeService } from './stripe.service';

/**
 * The only writer of Stripe state.
 *
 * Nothing is recorded from the browser coming back from checkout: that
 * redirect can be lost to a closed tab, a dead battery or a flaky network,
 * and a payment that succeeded must still be recorded. Two writers would
 * also mean two paths that can disagree, and the redirect is the unreliable
 * one.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly signingSecret: string | undefined;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly stripeService: StripeService,
    configService: ConfigService,
  ) {
    this.signingSecret = configService.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  /**
   * Verifies the signature before anything else. An unverified body is just
   * a stranger's POST claiming someone paid.
   */
  verify(payload: Buffer, signature: string | undefined): Stripe.Event {
    if (!this.signingSecret) {
      throw new BadRequestException('Webhooks are not configured.');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature.');
    }

    try {
      return this.stripeService.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.signingSecret,
      );
    } catch (error) {
      throw new BadRequestException(
        `Stripe signature did not verify: ${String(error)}`,
      );
    }
  }

  async handle(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.onCheckoutCompleted(event.data.object);
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.onSubscriptionChanged(event.data.object);
      default:
        this.logger.log(`Ignoring ${event.type}.`);
    }
  }

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const organisationId = session.metadata?.[ORGANISATION_METADATA_KEY];
    if (!organisationId) {
      this.logger.warn(
        `Checkout session ${session.id} carried no organisation; ignored.`,
      );
      return;
    }

    await this.write(organisationId, {
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : null,
      billingPeriod: session.metadata?.period ?? null,
    });
  }

  private async onSubscriptionChanged(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const organisationId =
      subscription.metadata?.[ORGANISATION_METADATA_KEY] ?? null;

    const existing = organisationId
      ? null
      : await this.subscriptions.findOne({
          where: { stripeSubscriptionId: subscription.id },
        });

    const target = organisationId ?? existing?.organisationId;
    if (!target) {
      this.logger.warn(
        `Subscription ${subscription.id} matches no organisation; ignored.`,
      );
      return;
    }

    const periodEnd = (
      subscription as unknown as { current_period_end?: number }
    ).current_period_end;

    await this.write(target, {
      stripeCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : null,
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    });
  }

  /**
   * Refuses to touch an Organisation that never pays. A webhook must never be
   * able to make a free-by-config Organisation start owing money — that is
   * the failsafe the configuration exists for, and it has to hold even when
   * Stripe says otherwise.
   */
  private async write(
    organisationId: string,
    fields: QueryDeepPartialEntity<Subscription>,
  ): Promise<void> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    if (!organisation) {
      this.logger.warn(`Organisation ${organisationId} not found; ignored.`);
      return;
    }
    if (this.stripeService.isFree(organisation.publicId)) {
      this.logger.warn(
        `Organisation ${organisation.publicId} never pays; Stripe event ignored.`,
      );
      return;
    }

    const existing = await this.subscriptions.findOne({
      where: { organisationId },
    });
    if (!existing) {
      this.logger.warn(
        `Organisation ${organisation.publicId} has no subscription row; ignored.`,
      );
      return;
    }

    await this.subscriptions.update(existing.id, fields);
    this.logger.log(
      `Organisation ${organisation.publicId}: ${Object.keys(fields).join(', ')} updated from Stripe.`,
    );
  }
}
