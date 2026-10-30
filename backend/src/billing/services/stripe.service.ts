import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { parseFreeOrganisationIds } from '../free-organisations';
import {
  CLOUD_PRICES,
  CLOUD_PRODUCT_NAME,
  type BillingPeriod,
} from '../pricing';

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
  /**
   * The Stripe Product every charge hangs off. Optional: where it is unset
   * the first charge creates one and remembers it for the life of the
   * process — see `productId`.
   */
  private readonly configuredProductId: string | undefined;
  private resolvedProductId: string | null = null;
  private readonly freeOrganisationIds: Set<number>;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    this.client = secretKey ? new Stripe(secretKey) : null;
    this.configuredProductId = configService.get<string>('STRIPE_PRODUCT_ID');
    this.freeOrganisationIds = parseFreeOrganisationIds(
      configService.get<string>('BILLING_FREE_ORGANISATION_IDS'),
    );
  }

  /** Whether this Organisation never pays. See free-organisations.ts. */
  isFree(publicId: number): boolean {
    return this.freeOrganisationIds.has(publicId);
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

  /**
   * What to charge, built from `CLOUD_PRICES` rather than looked up in
   * Stripe.
   *
   * The amounts used to live in two places — these constants, and a pair of
   * Stripe Price objects named by environment variables — with a start-up
   * check refusing to boot when they disagreed. That check existed only
   * because of the duplication. Passing the figures inline removes both: the
   * backend is the single source, nothing has to be created in the Stripe
   * dashboard before billing works, and there is no drift left to guard
   * against.
   *
   * A Product is still needed; Stripe has no inline equivalent for one on a
   * subscription item.
   */
  async priceDataFor(
    period: BillingPeriod,
  ): Promise<Stripe.SubscriptionCreateParams.Item.PriceData> {
    const price = CLOUD_PRICES[period];
    return {
      currency: price.currency,
      product: await this.productId(),
      recurring: { interval: price.interval },
      unit_amount: price.amountMinor,
    };
  }

  /**
   * The Product to hang prices off, created on first use where none is
   * configured.
   *
   * Found by name before creating, so a restart does not leave a trail of
   * duplicates, and cached for the process so the common path costs nothing.
   * Set `STRIPE_PRODUCT_ID` to point at an existing one instead.
   */
  private async productId(): Promise<string> {
    if (this.configuredProductId) return this.configuredProductId;
    if (this.resolvedProductId) return this.resolvedProductId;

    const existing = await this.stripe.products.search({
      query: `active:'true' AND name:'${CLOUD_PRODUCT_NAME}'`,
      limit: 1,
    });
    const found = existing.data[0];
    if (found) {
      this.resolvedProductId = found.id;
      return found.id;
    }

    const created = await this.stripe.products.create({
      name: CLOUD_PRODUCT_NAME,
    });
    this.logger.log(
      `Created Stripe Product ${created.id} for ${CLOUD_PRODUCT_NAME}.`,
    );
    this.resolvedProductId = created.id;
    return created.id;
  }

  onModuleInit(): void {
    this.logger.log(
      this.client
        ? 'Stripe is configured; prices come from billing/pricing.ts.'
        : 'Stripe is not configured; billing is off.',
    );
  }
}
