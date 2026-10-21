import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BILLING_PERIODS, CLOUD_PRICES, type BillingPeriod } from '../pricing';
import {
  describeMismatches,
  findPriceMismatch,
  type PriceMismatch,
} from '../stripe-prices';

/**
 * The Stripe client, and the one thing that must be true before it is used:
 * that the Prices it will charge against are the Prices this app advertises.
 *
 * Absent configuration is not an error. A self-hosted install has no Stripe
 * and must boot and work without it ("Billing switched off for self-hosted
 * installs"), so `isConfigured` is how every caller asks.
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly priceIds: Record<BillingPeriod, string | undefined>;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    this.client = secretKey ? new Stripe(secretKey) : null;
    this.priceIds = {
      monthly: configService.get<string>('STRIPE_PRICE_MONTHLY'),
      annual: configService.get<string>('STRIPE_PRICE_ANNUAL'),
    };
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Throws unless Stripe is configured — callers check `isConfigured` first. */
  get stripe(): Stripe {
    if (!this.client) {
      throw new Error('Stripe is not configured on this installation.');
    }
    return this.client;
  }

  priceIdFor(period: BillingPeriod): string {
    const id = this.priceIds[period];
    if (!id) {
      throw new Error(`No Stripe Price configured for ${period} billing.`);
    }
    return id;
  }

  /**
   * Refuses to start when Stripe would charge an amount this app does not
   * advertise. A wrong price is worse than no billing: nobody notices until
   * a customer is charged, and by then it has happened.
   */
  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.log('Stripe is not configured; billing is off.');
      return;
    }

    const mismatches = await this.findPriceMismatches();
    if (mismatches.length > 0) {
      throw new Error(
        `Stripe Prices do not match this app's prices: ${describeMismatches(mismatches)}. ` +
          'Fix the Price in Stripe or the constants in billing/pricing.ts before starting.',
      );
    }

    this.logger.log('Stripe Prices match the advertised prices.');
  }

  async findPriceMismatches(): Promise<PriceMismatch[]> {
    const mismatches: PriceMismatch[] = [];

    for (const period of BILLING_PERIODS) {
      const price = await this.stripe.prices.retrieve(this.priceIdFor(period));
      const mismatch = findPriceMismatch(period, CLOUD_PRICES[period], {
        id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring
          ? { interval: price.recurring.interval }
          : null,
      });
      if (mismatch) mismatches.push(mismatch);
    }

    return mismatches;
  }
}
