import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Subscription } from '../../database/entities/subscription.entity';
import { BILLING_PERIODS, type BillingPeriod } from '../pricing';
import {
  subscriptionView,
  type PaidSubscriptionView,
} from '../subscription-view';
import { BilledSeatsService } from './billed-seats.service';
import { StripeService } from './stripe.service';

/** Paid, else finalised, else created — the most meaningful date it has. */
function invoiceDate(invoice: Stripe.Invoice): string | null {
  const seconds =
    invoice.status_transitions?.paid_at ??
    invoice.status_transitions?.finalized_at ??
    invoice.created;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * What the row says it was for — "50 seats", else whatever Stripe wrote on
 * the line. A prorated top-up and a renewal both appear here, and the seat
 * count is what tells them apart at a glance.
 */
function describeInvoice(invoice: Stripe.Invoice): string | null {
  const lines = invoice.lines?.data ?? [];
  const quantity = lines.find((line) => line.quantity)?.quantity;
  if (quantity) {
    return `${quantity} ${quantity === 1 ? 'seat' : 'seats'}`;
  }
  return lines.find((line) => line.description)?.description ?? null;
}

/** What the paid Billing page renders, read live from Stripe. */
export interface PaidSubscriptionDetails extends PaidSubscriptionView {
  /** Active Memberships, for the seats panel. */
  memberCount: number;
  /** What the next invoice comes to, from Stripe's own preview. */
  nextPaymentMinor: number | null;
  currency: string;
}

/** One invoice, as the Billing info page lists it. */
export interface InvoiceSummary {
  id: string;
  /** ISO — when it was paid, falling back to when it was raised. */
  date: string | null;
  amountMinor: number;
  currency: string;
  status: string | null;
  /** Stripe's own hosted PDF. Null until the invoice is finalised. */
  pdfUrl: string | null;
  /** "Annual · 50 seats", read off the line items. */
  description: string | null;
}

/** What a seat change costs, previewed before anything is committed. */
export interface SeatChangePreview {
  seats: number;
  /** Taken now (annual) or added to the next invoice (monthly). */
  proratedNowMinor: number;
  /** What the next invoice becomes. */
  nextPaymentMinor: number;
  /** What it is today, for an "old → new" line. */
  currentNextPaymentMinor: number;
  currency: string;
  /** ISO, the date the prorated amount is charged on. */
  chargedAt: string | null;
}

/**
 * Everything about a subscription that already exists. **Reads Stripe,
 * stores nothing** — our row keeps only the ids needed to find it again,
 * plus the trial history.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    private readonly stripeService: StripeService,
    private readonly billedSeats: BilledSeatsService,
  ) {}

  /** Null for an Organisation with no Stripe subscription — every trial. */
  async detailsFor(
    organisationId: string,
  ): Promise<PaidSubscriptionDetails | null> {
    const remote = await this.remote(organisationId);
    if (!remote) return null;

    const view = subscriptionView(remote);
    if (!view) return null;

    const { memberCount } =
      await this.billedSeats.forOrganisation(organisationId);

    return {
      ...view,
      memberCount,
      nextPaymentMinor: await this.previewNextPayment(remote),
      currency: remote.currency,
    };
  }

  /**
   * `cancel_at_period_end`, not `subscriptions.cancel`: the latter ends it
   * on the spot and is terminal, taking away a period already paid for.
   */
  async setAutoRenew(organisationId: string, on: boolean): Promise<void> {
    const remote = await this.remote(organisationId);
    if (!remote) {
      throw new NotFoundException('This organisation has no subscription.');
    }

    await this.stripeService.stripe.subscriptions.update(remote.id, {
      cancel_at_period_end: !on,
    });
    this.logger.log(
      `Organisation ${organisationId} auto-renew ${on ? 'on' : 'off'}.`,
    );
  }

  /**
   * What changing the seat count would cost, from Stripe's own invoice
   * preview rather than our arithmetic — proration is Stripe's to calculate
   * and a figure of ours that disagreed with the invoice would be worse
   * than no figure.
   */
  async previewSeatChange(
    organisationId: string,
    seats: number,
  ): Promise<SeatChangePreview> {
    const remote = await this.remote(organisationId);
    const item = remote?.items.data[0];
    if (!remote || !item) {
      throw new NotFoundException('This organisation has no subscription.');
    }

    const [proposed, current] = await Promise.all([
      this.preview(remote, [{ id: item.id, quantity: seats }]),
      this.preview(remote, undefined),
    ]);

    // The difference between the two previews is what the extra seats cost
    // before the next renewal — Stripe's arithmetic, not ours. Floored at
    // zero: lowering the seat count produces a credit, which is not a charge
    // to warn anybody about.
    return {
      seats,
      proratedNowMinor: Math.max(proposed.amount_due - current.amount_due, 0),
      nextPaymentMinor: proposed.amount_due,
      currentNextPaymentMinor: current.amount_due,
      currency: remote.currency,
      chargedAt: proposed.next_payment_attempt
        ? new Date(proposed.next_payment_attempt * 1000).toISOString()
        : null,
    };
  }

  /** Switches between the monthly and annual price, Stripe prorating it. */
  async switchCycle(
    organisationId: string,
    period: BillingPeriod,
  ): Promise<void> {
    if (!BILLING_PERIODS.includes(period)) {
      throw new BadRequestException(`Unknown billing period: ${period}`);
    }
    const remote = await this.remote(organisationId);
    const item = remote?.items.data[0];
    if (!remote || !item) {
      throw new NotFoundException('This organisation has no subscription.');
    }

    await this.stripeService.stripe.subscriptions.update(remote.id, {
      items: [
        {
          id: item.id,
          price_data: await this.stripeService.priceDataFor(period),
          quantity: item.quantity ?? 1,
        },
      ],
      proration_behavior: 'create_prorations',
    });
    this.logger.log(`Organisation ${organisationId} switched to ${period}.`);
  }

  /**
   * The invoices Stripe has raised, newest first. Never stored: an invoice
   * can be voided or refunded later, and a copy would disagree with the PDF
   * it links to.
   */
  async invoicesFor(organisationId: string): Promise<InvoiceSummary[]> {
    const remote = await this.remote(organisationId);
    if (!remote) return [];

    try {
      const invoices = await this.stripeService.stripe.invoices.list({
        subscription: remote.id,
        limit: 24,
      });
      return invoices.data.map((invoice) => ({
        id: invoice.id ?? '',
        date: invoiceDate(invoice),
        // `amount_paid` would read 0 for anything still open, which is the
        // one row somebody most wants the figure for.
        amountMinor: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        pdfUrl: invoice.invoice_pdf ?? null,
        description: describeInvoice(invoice),
      }));
    } catch (error) {
      this.logger.error(
        `Could not list invoices for organisation ${organisationId}: ${String(error)}`,
      );
      return [];
    }
  }

  /**
   * Stripe's Customer Portal, for managing the card and invoice history.
   * Hosted rather than rebuilt: a card form of ours would be a second
   * Elements integration and a SetupIntent flow for a job Stripe already
   * does, with 3-D Secure and dunning recovery attached — and it is where
   * Stripe's own billing emails send people.
   */
  async portalUrl(organisationId: string, returnUrl: string): Promise<string> {
    const row = await this.subscriptions.findOne({ where: { organisationId } });
    if (!row?.stripeCustomerId) {
      throw new NotFoundException(
        'This organisation has no billing account yet.',
      );
    }

    const session =
      await this.stripeService.stripe.billingPortal.sessions.create({
        customer: row.stripeCustomerId,
        return_url: returnUrl,
      });
    return session.url;
  }

  /** The Stripe subscription behind an Organisation, expanded for the view. */
  private async remote(
    organisationId: string,
  ): Promise<Stripe.Subscription | null> {
    if (!this.stripeService.isConfigured) return null;

    const row = await this.subscriptions.findOne({ where: { organisationId } });
    if (!row?.stripeSubscriptionId) return null;

    try {
      return await this.stripeService.stripe.subscriptions.retrieve(
        row.stripeSubscriptionId,
        // The card is the only thing the page needs that is not on the
        // subscription itself.
        { expand: ['default_payment_method'] },
      );
    } catch (error) {
      this.logger.error(
        `Could not read subscription for organisation ${organisationId}: ${String(error)}`,
      );
      return null;
    }
  }

  /**
   * `invoices.createPreview`, which replaced `retrieveUpcoming` — the older
   * method is gone from this SDK entirely.
   */
  private preview(
    subscription: Stripe.Subscription,
    items: Array<{ id: string; quantity: number }> | undefined,
  ): Promise<Stripe.Invoice> {
    return this.stripeService.stripe.invoices.createPreview({
      subscription: subscription.id,
      ...(items
        ? {
            subscription_details: {
              items,
              proration_behavior: 'create_prorations',
            },
          }
        : {}),
    });
  }

  private async previewNextPayment(
    subscription: Stripe.Subscription,
  ): Promise<number | null> {
    try {
      const upcoming = await this.preview(subscription, undefined);
      return upcoming.amount_due;
    } catch (error) {
      // A cancelled subscription has no upcoming invoice, which is a normal
      // state rather than a fault — the page says "Ends on" instead.
      this.logger.log(
        `No upcoming invoice for ${subscription.id}: ${String(error)}`,
      );
      return null;
    }
  }
}
