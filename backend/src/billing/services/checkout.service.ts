import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { BILLING_PERIODS, type BillingPeriod } from '../pricing';
import { BilledSeatsService } from './billed-seats.service';
import { StripeService } from './stripe.service';

/** The organisation id Stripe hands back on the webhook. */
export const ORGANISATION_METADATA_KEY = 'organisationId';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly stripeService: StripeService,
    private readonly billedSeatsService: BilledSeatsService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');
  }

  /**
   * A Stripe-hosted checkout page for this Organisation, priced per seat.
   *
   * Hosted rather than our own card form: no card details reach this app, and
   * there is no publishable key or Stripe.js to ship. The quantity is the
   * billed seat count at the moment of checkout; webhooks keep it current
   * afterwards.
   */
  async createSessionUrl(
    organisationId: string,
    period: BillingPeriod,
  ): Promise<string> {
    if (!BILLING_PERIODS.includes(period)) {
      throw new BadRequestException(`Unknown billing period: ${period}`);
    }
    if (!this.stripeService.isConfigured) {
      throw new BadRequestException(
        'Billing is not available on this installation.',
      );
    }

    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }

    if (this.stripeService.isFree(organisation.publicId)) {
      throw new BadRequestException(
        'This organisation does not pay for Hi Day.',
      );
    }

    const subscription = await this.subscriptions.findOne({
      where: { organisationId },
    });
    if (subscription?.stripeSubscriptionId) {
      throw new BadRequestException(
        'This organisation already has a subscription.',
      );
    }

    const { count } =
      await this.billedSeatsService.forOrganisation(organisationId);
    const billingHref = `${this.frontendUrl}/organisations/${organisation.publicId}/settings/billing/subscription`;

    const session = await this.stripeService.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        { price: this.stripeService.priceIdFor(period), quantity: count },
      ],
      // Read back on the webhook: it is the only link from a Stripe object to
      // the Organisation that paid for it.
      metadata: { [ORGANISATION_METADATA_KEY]: organisationId, period },
      subscription_data: {
        metadata: { [ORGANISATION_METADATA_KEY]: organisationId, period },
      },
      customer_email: subscription ? undefined : undefined,
      success_url: `${billingHref}?checkout=done`,
      cancel_url: `${billingHref}?checkout=cancelled`,
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout page.');
    }

    this.logger.log(
      `Checkout started for organisation ${organisation.publicId}: ${count} seat(s), ${period}.`,
    );
    return session.url;
  }
}
