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
import { billingRecipients, invoiceRecipient } from '../billing-recipients';
import { declineReason } from '../payment-failure';
import { formatMinor } from '../pricing';
import { isStripeMissing } from '../stripe-missing';
import { hasEnded } from '../stripe-subscription-states';
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
 * The events `handle` below acts on, and the exact list the Stripe endpoint
 * must be subscribed to.
 *
 * Exported so registering the endpoint reads it from here rather than
 * repeating it (`pnpm --filter backend stripe:register-webhook`). Three
 * copies of this list — the switch, the README and the dashboard — is three
 * chances for one to fall behind, and an event that is handled but never
 * subscribed to simply never arrives. `webhook-events.spec.ts` fails if the
 * switch and this array disagree.
 *
 * Anything not listed is still answered 200 and ignored, so subscribing to
 * more than this is harmless — just noisier.
 */
export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.upcoming',
] as const satisfies readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[];

/**
 * The writer of Stripe state. Never the browser returning from checkout:
 * that redirect is lost to a closed tab or a flaky network, and a payment
 * that succeeded must still be recorded. The one exception is checkout
 * itself, which stores the customer and subscription ids it has just
 * created so that a second checkout cannot start beside them — the events
 * for those then confirm what is already there.
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
      case 'invoice.payment_failed':
        return this.onInvoicePaymentFailed(event.data.object);
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

    // An Organisation can go through more than one subscription — a retry
    // after a declined card, a customer coming back after cancelling — and
    // Stripe does not deliver events in order. An event about a subscription
    // other than the stored one must not point our row at it unless it is
    // the one that should win, or the live subscription is lost: seats stop
    // syncing, the portal and deletion act on the wrong one, and paying
    // again would bill twice.
    const current =
      existing ??
      (await this.subscriptions.findOne({ where: { organisationId: target } }));
    if (
      current?.stripeSubscriptionId &&
      current.stripeSubscriptionId !== subscription.id &&
      !(await this.replaces(subscription, current.stripeSubscriptionId))
    ) {
      this.logger.log(
        `Subscription ${subscription.id} (${subscription.status}) was replaced by ${current.stripeSubscriptionId}; event acknowledged without action.`,
      );
      return;
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
      // Deleted organisations are cancelled in Stripe before their row goes,
      // so this should never happen — but if it does, no retry can bring the
      // organisation back. Shouted about rather than retried: money was
      // taken, and somebody needs to look at whether it is owed back.
      if (organisationId && (await this.isGone(organisationId))) {
        this.logger.error(
          `Paid invoice ${invoice.id} is for organisation ${organisationId}, which has been deleted; acknowledged without action. Check whether it needs refunding.`,
        );
        return;
      }
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

  /**
   * A declined charge — including the seat charge raised the moment somebody
   * joined past the purchased seats (see `pushQuantity`).
   *
   * Nothing is stored and nothing is undone: a card failing is a billing
   * problem, not grounds to throw somebody out of an Organisation they were
   * invited to. Stripe's Smart Retries own the recovery; this handler's one
   * job is making sure a human who can fix the card hears about it.
   *
   * An unplaceable failed invoice is accepted rather than retried, unlike an
   * unplaceable *paid* one — there is no money to lose track of, and
   * `stripe trigger` fabricates exactly this shape.
   */
  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const details = invoice.parent?.subscription_details;
    const organisationId = details?.metadata?.[ORGANISATION_METADATA_KEY];

    const existing = organisationId
      ? await this.subscriptions.findOne({ where: { organisationId } })
      : await this.subscriptionForStripeId(details?.subscription);

    if (!existing) {
      this.logger.warn(
        `Failed invoice ${invoice.id} matches no organisation; nobody to tell.`,
      );
      return;
    }

    this.logger.warn(
      `Invoice ${invoice.id} failed for organisation ${existing.organisationId}; Stripe will retry.`,
    );

    // One email per failed attempt, deliberately not deduplicated. This
    // handler answers 200, so Stripe never redelivers the same attempt —
    // every one of these is a genuinely new decline worth repeating.
    try {
      const organisation = await this.organisations.findOne({
        where: { id: existing.organisationId },
        relations: { owner: true },
      });
      if (!organisation) return;

      // The owner *and* the billing address, unlike a receipt: the seats are
      // already being used, so this must not be lost to a typo in an
      // unverified address — see `billingRecipients`.
      const to = billingRecipients(
        organisation.billingEmail,
        organisation.owner?.email ?? null,
      );
      if (to.length === 0) return;

      await this.emailService.sendSeatChargeFailedEmail(
        to,
        organisation.name,
        formatMinor(invoice.amount_due, invoice.currency),
        await this.declineReasonFor(invoice),
        invoice.hosted_invoice_url ?? null,
      );
    } catch (error) {
      this.logger.error(
        `Could not warn about failed invoice ${invoice.id}: ${String(error)}`,
      );
    }
  }

  /**
   * Why the card was refused, in the issuer's own words.
   *
   * Costs an extra call: Stripe moved the PaymentIntent off the Invoice onto
   * its `payments`, and a webhook body expands neither, so the reason is not
   * in the event. Falls back to a generic line rather than failing — an
   * email naming no reason still beats no email.
   */
  private async declineReasonFor(invoice: Stripe.Invoice): Promise<string> {
    if (!invoice.id) return declineReason(null);

    try {
      const payments = await this.stripeService.stripe.invoicePayments.list({
        invoice: invoice.id,
        expand: ['data.payment.payment_intent'],
      });

      const failed = payments.data
        .map((payment) => payment.payment.payment_intent)
        .find(
          (intent): intent is Stripe.PaymentIntent =>
            typeof intent === 'object' && intent !== null,
        );

      return declineReason(failed?.last_payment_error);
    } catch (error) {
      this.logger.warn(
        `Could not read why invoice ${invoice.id} failed: ${String(error)}`,
      );
      return declineReason(null);
    }
  }

  /**
   * Whether `incoming` should take over from the subscription our row points
   * at. Never one that has ended or is older. And never an attempt still
   * awaiting its first payment over one that can still charge: an unpaid
   * second tab must not displace the subscription actually being paid.
   *
   * A stored id Stripe no longer has is replaced; any other failure throws,
   * and Stripe retries the event.
   */
  private async replaces(
    incoming: Stripe.Subscription,
    storedId: string,
  ): Promise<boolean> {
    if (hasEnded(incoming.status)) return false;

    let stored: Stripe.Subscription;
    try {
      stored = await this.stripeService.stripe.subscriptions.retrieve(storedId);
    } catch (error) {
      if (isStripeMissing(error)) return true;
      throw error;
    }

    if (incoming.created < stored.created) return false;
    const storedCanCharge =
      stored.status !== 'incomplete' && !hasEnded(stored.status);
    return !(incoming.status === 'incomplete' && storedCanCharge);
  }

  private async isGone(organisationId: string): Promise<boolean> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    return organisation === null;
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
      // Not a race — the organisation exists long before any checkout — so
      // it has been deleted, and a retry can never succeed. The common
      // case is our own cancellation during the purge, whose
      // `customer.subscription.deleted` lands after the row is gone.
      // Answering 503 here had Stripe retrying for three days per event,
      // and risked it disabling the endpoint for every customer.
      this.logger.warn(
        `Organisation ${organisationId} no longer exists; Stripe event acknowledged without action.`,
      );
      return;
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
