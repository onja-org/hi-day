import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type Stripe from 'stripe';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { SubscriptionStatus } from '../../database/entities/subscription-status.enum';
import { EmailService } from '../../email/services/email.service';
import { invoiceRecipient } from '../billing-recipients';
import { formatMinor } from '../pricing';
import { ORGANISATION_METADATA_KEY } from './checkout.service';
import { StripeService } from './stripe.service';

/**
 * An event we could not place, which Stripe should send again.
 *
 * 503 rather than 400: nothing is wrong with the request, we are simply not
 * ready for it yet — almost always because a row is mid-write. The status
 * is what makes Stripe retry; the type is what stops a reader thinking this
 * is a validation failure.
 */
export class UnplacedStripeEvent extends ServiceUnavailableException {
  constructor(detail: string) {
    super(`${detail}; Stripe should retry.`);
  }
}

/**
 * When the period being paid for ends — what a cancellation runs until, and
 * what the grace period is measured from (`docs/adr/0030-...`).
 *
 * Read from the **item**: Stripe moved `current_period_end` off the
 * Subscription, and reading it there through a cast compiled fine and
 * returned `undefined` every time, so every webhook wrote null.
 */
export function currentPeriodEndOf(
  subscription: Stripe.Subscription,
): number | undefined {
  const ends = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number');
  return ends?.length ? Math.max(...ends) : undefined;
}

/**
 * The only writer of Stripe state. Never the browser returning from
 * checkout: that redirect is lost to a closed tab or a flaky network, and a
 * payment that succeeded must still be recorded.
 *
 * A 2xx tells Stripe never to send an event again, so the difference
 * between "ignored on purpose" and "could not do it" has to reach the HTTP
 * status or a dropped event is dropped for good:
 *
 * - **Ignored on purpose → 2xx.** An event type we do not handle, a
 *   free-by-config Organisation, a malformed event no retry could fix.
 * - **Could not place it → throw.** Usually a race, which the retry fixes.
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
    private readonly emailService: EmailService,
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
      // Both names for the same thing, depending on API version. The
      // handler is idempotent, so being told twice costs nothing.
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        return this.onInvoicePaid(event.data.object);
      // Nothing to store for either: the Billing page reads the failure
      // straight off the subscription's status, and Stripe's Smart Retries
      // own the recovery. Logged so a failing renewal is visible in ours.
      case 'invoice.payment_failed':
        this.logger.warn(
          `Invoice ${event.data.object.id} failed; Stripe will retry.`,
        );
        return;
      case 'invoice.upcoming':
        this.logger.log(
          `Renewal upcoming for invoice preview ${event.data.object.id ?? '(none)'}.`,
        );
        return;
      default:
        this.logger.log(`Ignoring ${event.type}.`);
    }
  }

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const organisationId = session.metadata?.[ORGANISATION_METADATA_KEY];
    if (!organisationId) {
      // Metadata is written when the session is created and never changes,
      // so a retry would carry exactly the same nothing. Accepted and
      // logged rather than retried for three days.
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
      throw new UnplacedStripeEvent(
        `Subscription ${subscription.id} matches no organisation`,
      );
    }

    const periodEnd = currentPeriodEndOf(subscription);

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
  /**
   * A payment went through. The one event that ends a trial, and never
   * taken from the client — a browser can be closed, lose its network, or
   * lie.
   *
   * Idempotent by construction: it writes only on the `trialing` → `active`
   * transition, so retries, the duplicate event pair, and every renewal for
   * years afterwards all find the row active and do nothing. That is also
   * what keeps `trialEndedAt` on the *first* payment.
   */
  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const details = invoice.parent?.subscription_details;
    const organisationId = details?.metadata?.[ORGANISATION_METADATA_KEY];

    // The metadata is a snapshot taken when the invoice was finalised, so
    // for anything created before that existed, fall back to the
    // subscription this row already knows about.
    const existing = organisationId
      ? await this.subscriptions.findOne({ where: { organisationId } })
      : await this.subscriptionForStripeId(details?.subscription);

    if (!existing) {
      // The common cause is a race: Stripe raises and pays the first invoice
      // while `checkout.session.completed` is still being written. Retrying
      // is exactly right, and the money is already taken — losing this event
      // leaves somebody paying for a trial.
      throw new UnplacedStripeEvent(
        `Paid invoice ${invoice.id} matches no organisation`,
      );
    }

    // The receipt goes out for the first payment *and* every renewal, so it
    // is sent before the status guard below — which only ever fires once.
    await this.emailReceipt(existing, invoice);

    if (existing.status === SubscriptionStatus.ACTIVE) {
      // The ordinary case after the first payment: a renewal, or Stripe
      // repeating itself. Nothing left to change.
      return;
    }

    await this.write(existing.organisationId, {
      status: SubscriptionStatus.ACTIVE,
      // The day the trial actually stopped, which is today — not
      // `trialEndsAt`, which is only where it would have run to.
      trialEndedAt: new Date(),
    });
    this.logger.log(
      `Organisation ${existing.organisationId} is now paying; trial ended.`,
    );
  }

  /**
   * Emails the receipt, once per invoice — guarded on the invoice id rather
   * than a flag, since Stripe sends two event names for the same money and
   * retries both, and each new invoice has a new id.
   *
   * Recorded *before* the send: a duplicate receipt reads as a duplicate
   * charge. Never throws — a receipt is not worth making Stripe retry a
   * payment event.
   */
  private async emailReceipt(
    row: Subscription,
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (!invoice.id || row.lastInvoiceEmailedId === invoice.id) return;

    try {
      const organisation = await this.organisations.findOne({
        where: { id: row.organisationId },
        relations: { owner: true },
      });
      if (!organisation) return;

      // The billing address when one is set, else the address they signed
      // up with. One recipient, unlike a warning — see `invoiceRecipient`.
      const to = invoiceRecipient(
        organisation.billingEmail,
        organisation.owner?.email ?? null,
      );
      if (!to) return;

      await this.subscriptions.update(row.id, {
        lastInvoiceEmailedId: invoice.id,
      });

      await this.emailService.sendInvoiceEmail(
        to,
        organisation.name,
        formatMinor(
          invoice.amount_paid || invoice.amount_due,
          invoice.currency,
        ),
        invoice.hosted_invoice_url ?? null,
        invoice.number ?? null,
      );
    } catch (error) {
      this.logger.error(
        `Could not email the receipt for invoice ${invoice.id}: ${String(error)}`,
      );
    }
  }

  /** The row behind a Stripe subscription id, expanded or not. */
  private async subscriptionForStripeId(
    subscription: string | Stripe.Subscription | undefined,
  ): Promise<Subscription | null> {
    const id =
      typeof subscription === 'string' ? subscription : subscription?.id;
    if (!id) return null;
    return this.subscriptions.findOne({
      where: { stripeSubscriptionId: id },
    });
  }

  private async write(
    organisationId: string,
    fields: QueryDeepPartialEntity<Subscription>,
  ): Promise<void> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    if (!organisation) {
      throw new UnplacedStripeEvent(`Organisation ${organisationId} not found`);
    }
    // The one case that is genuinely ignored rather than retried: a
    // free-by-config Organisation must never start owing money, however
    // often Stripe insists. This is the failsafe the list exists for.
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
      throw new UnplacedStripeEvent(
        `Organisation ${organisation.publicId} has no subscription row`,
      );
    }

    await this.subscriptions.update(existing.id, fields);
    this.logger.log(
      `Organisation ${organisation.publicId}: ${Object.keys(fields).join(', ')} updated from Stripe.`,
    );
  }
}
