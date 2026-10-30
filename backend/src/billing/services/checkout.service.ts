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
import {
  BILLING_PERIODS,
  CLOUD_PRICES,
  nextPaymentFrom,
  type BillingPeriod,
} from '../pricing';
import { BilledSeatsService } from './billed-seats.service';
import { StripeService } from './stripe.service';

/** The organisation id Stripe hands back on the webhook. */
export const ORGANISATION_METADATA_KEY = 'organisationId';

/** What the in-app payment modal needs to draw itself and take a card. */
export interface SubscriptionIntent {
  /** What Stripe Elements confirms the card against. Not a secret to us. */
  clientSecret: string;
  seats: number;
  period: BillingPeriod;
  /** Per seat x seats, in minor units — the recurring charge. */
  amountMinor: number;
  /**
   * What is taken today, which is the full amount: paying ends the trial
   * there and then and starts the paid period from that moment
   * (`docs/adr/0031-...`). Equal to `amountMinor` — kept as its own field so
   * the modal reads what it charges rather than inferring it.
   */
  chargedTodayMinor: number;
  /**
   * ISO, when the next charge falls — a month or a year from today
   * depending on the cycle. Computed here rather than in the browser so the
   * figure the modal promises is the one the server is about to set up.
   */
  nextPaymentAt: string;
  currency: string;
}

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
   * Everything the in-app payment modal needs to take a card: the amount it
   * is about to charge, and the secret Stripe Elements confirms against.
   *
   * The subscription is created here in `default_incomplete`, which makes
   * Stripe raise the first invoice without collecting on it, and the card is
   * confirmed in the browser against that invoice. Card details still never
   * reach this app — Elements posts them straight to Stripe — so the only
   * thing that changed from the hosted page is who draws the form.
   *
   * The client secret comes from `latest_invoice.confirmation_secret`, not
   * `latest_invoice.payment_intent`: that field was removed from the Invoice
   * object in Stripe's `2025-03-31.basil` API version, and this SDK pins
   * `2026-09-30.endive`.
   */
  async createSubscriptionIntent(
    organisationId: string,
    period: BillingPeriod,
    /**
     * How many seats the modal told the admin they were buying.
     *
     * Checked, never trusted: the quantity charged is always the server's
     * own `max(purchasedSeats, members)`. This exists because the seat
     * counter saves debounced, so an admin can raise it to eight and press
     * Add payment before the save lands — and charging six against a modal
     * showing eight is the one outcome worth failing a request over. A
     * mismatch asks them to try again rather than quietly charging either
     * figure.
     */
    expectedSeats?: number,
  ): Promise<SubscriptionIntent> {
    const { organisation, seats } = await this.readyToCharge(
      organisationId,
      period,
    );

    if (expectedSeats !== undefined && expectedSeats !== seats) {
      throw new BadRequestException(
        `Your seat count changed to ${seats} while you were paying. Check the total and try again.`,
      );
    }

    const customer = await this.stripeService.stripe.customers.create({
      // The billing address when set, else the owner's — the same rule the
      // billing mail follows (see `billingRecipients`).
      email: organisation.billingEmail ?? undefined,
      name: organisation.name,
      metadata: { [ORGANISATION_METADATA_KEY]: organisationId },
    });

    const subscription = await this.stripeService.stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: await this.stripeService.priceDataFor(period),
          quantity: seats,
        },
      ],
      // No `trial_end`: paying ends the trial immediately and the paid
      // period starts today, so Stripe raises a full invoice now rather than
      // waiting for a date the Organisation has chosen to stop waiting for.
      // Raises the invoice without collecting on it, so the browser can.
      payment_behavior: 'default_incomplete',
      payment_settings: {
        // Keeps the card for the renewals, which is the point of a
        // subscription.
        save_default_payment_method: 'on_subscription',
        // Cards only, deliberately: the modal draws its own card number,
        // expiry, CVC and cardholder name, so an intent that also offered a
        // bank debit or a wallet would be offering what this form cannot
        // collect. Widening the form and widening this go together.
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.confirmation_secret'],
      // Read back on the webhook: the only link from a Stripe object to the
      // Organisation that paid for it.
      metadata: { [ORGANISATION_METADATA_KEY]: organisationId, period },
    });

    const invoice = subscription.latest_invoice;
    const clientSecret =
      invoice && typeof invoice !== 'string'
        ? invoice.confirmation_secret?.client_secret
        : null;
    if (!clientSecret) {
      // Nothing to confirm against means the modal has no way to take a
      // card, and showing it anyway would be a form that cannot submit.
      throw new BadRequestException(
        'Stripe did not return a payment secret for this subscription.',
      );
    }

    const amountMinor = CLOUD_PRICES[period].amountMinor * seats;

    this.logger.log(
      `Subscription intent created for organisation ${organisation.publicId}: ${seats} seat(s), ${period}.`,
    );

    return {
      clientSecret,
      seats,
      period,
      amountMinor,
      chargedTodayMinor: amountMinor,
      nextPaymentAt: nextPaymentFrom(new Date(), period).toISOString(),
      currency: CLOUD_PRICES[period].currency,
    };
  }

  /**
   * The checks both ways of paying share: a real Organisation, one that
   * pays, a configured Stripe, and no subscription already.
   */
  private async readyToCharge(
    organisationId: string,
    period: BillingPeriod,
  ): Promise<{ organisation: Organisation; seats: number }> {
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

    const existing = await this.subscriptions.findOne({
      where: { organisationId },
    });
    if (existing?.stripeSubscriptionId) {
      throw new BadRequestException(
        'This organisation already has a subscription.',
      );
    }

    // `count` is already max(purchased, members) — buying ten seats for a
    // team of four charges for ten, and a team of fourteen charges for
    // fourteen. See `billedSeatCount`.
    const { count } =
      await this.billedSeatsService.forOrganisation(organisationId);
    return { organisation, seats: count };
  }

  /**
   * A Stripe-hosted checkout page for this Organisation, priced per seat.
   *
   * Kept alongside the modal rather than deleted: it is the fallback when
   * Stripe.js cannot load, and the one path that needs no publishable key.
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
        {
          price_data: await this.stripeService.priceDataFor(period),
          quantity: count,
        },
      ],
      // Read back on the webhook: it is the only link from a Stripe object to
      // the Organisation that paid for it.
      metadata: { [ORGANISATION_METADATA_KEY]: organisationId, period },
      subscription_data: {
        metadata: { [ORGANISATION_METADATA_KEY]: organisationId, period },
      },
      // Where invoices and Stripe's own dunning mail go. Undefined lets
      // Checkout collect it, which is what happened before an Organisation
      // could say: the payer's address, known only to Stripe.
      customer_email: organisation.billingEmail ?? undefined,
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
