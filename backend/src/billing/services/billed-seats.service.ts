import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { billedSeatCount, isOverPurchasedSeats, seatsAreFull } from '../seats';
import { hasEnded } from '../stripe-subscription-states';
import { StripeService } from './stripe.service';

export interface BilledSeats {
  /**
   * What the next invoice covers: the seats bought or the people here,
   * whichever is larger (`billedSeatCount`).
   */
  count: number;
  /** Active Memberships. Pending invitations are not members yet. */
  memberCount: number;
  /** Null where none were ever bought — every Organisation on a trial. */
  purchasedSeats: number | null;
  /** More people than were paid for; what the members banner reads. */
  isOverPurchasedSeats: boolean;
  /**
   * Every purchased seat is taken, so the next person to join costs money
   * — what the consent in the invite forms asks about. True at exactly the
   * purchased count, not only past it (`seatsAreFull`).
   */
  seatsAreFull: boolean;
}

@Injectable()
export class BilledSeatsService {
  private readonly logger = new Logger(BilledSeatsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly stripeService: StripeService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * What the Organisation is billed for, and why that number.
   *
   * Counts **active Memberships**: a pending invitation is not a member and
   * nobody is billed for one, so the figure here and the figure on the
   * invoice are the same figure. Deactivated Memberships are not billed
   * either — see CONTEXT.md's Billed seat entry.
   *
   * The names used to come back with it, for an admin asking "why am I
   * paying for 14?". That question is now answered by the seat counter and
   * the members page, so this returns numbers only.
   */
  async forOrganisation(organisationId: string): Promise<BilledSeats> {
    const [memberCount, organisation] = await Promise.all([
      this.memberships.count({
        where: { organisationId, status: MembershipStatus.ACTIVE },
      }),
      this.organisations.findOne({ where: { id: organisationId } }),
    ]);

    const purchasedSeats = organisation?.purchasedSeats ?? null;

    return {
      count: billedSeatCount(purchasedSeats, memberCount),
      memberCount,
      purchasedSeats,
      isOverPurchasedSeats: isOverPurchasedSeats(purchasedSeats, memberCount),
      seatsAreFull: seatsAreFull(purchasedSeats, memberCount),
    };
  }

  /**
   * Records how many seats an admin has bought. Validation belongs to the
   * caller (`parseSeatCount`) — by here the number is one somebody meant.
   *
   * Pushes the new quantity straight to the provider, because buying seats
   * is precisely the moment the bill should change.
   */
  async setPurchasedSeats(
    organisationId: string,
    seats: number,
  ): Promise<BilledSeats> {
    await this.organisations.update(
      { id: organisationId },
      { purchasedSeats: seats },
    );
    // Pushes the resulting `max(purchased, members)` to Stripe, with the
    // proration each cycle needs — see `pushQuantity`. Buying seats is the
    // admin's own act on the Billing page, so a rise is charged at once.
    await this.syncToProvider(organisationId, { chargeNow: true });
    return this.forOrganisation(organisationId);
  }

  /**
   * Tells the payment provider how many seats to bill for, after anything
   * that can change the number: an invitation accepted, a member removed or
   * deactivated, a role changed.
   *
   * A no-op in the two cases where there is nothing to tell: billing is off
   * (`BILLING_ENABLED` — a self-hosted install, where no seat sync may happen
   * at all), or the Organisation has no subscription with the provider, which
   * is every Organisation until checkout completes.
   *
   * Where the count **rose** the extra seats are charged for on the spot,
   * through the quantity alone: `purchasedSeats` stays what the admin bought.
   * It used to be written up to the charged count, which made every arrival
   * permanent — the floor rose with each one, so deactivating somebody never
   * lowered the bill, against "Deactivated Memberships are not billed". Left
   * alone, a departure takes the quantity back down to the purchase.
   *
   * A rise is charged on the spot only with `chargeNow` — an admin's
   * consent, given in the invite forms or by buying seats (ADR 0033).
   * Without it the rise is billed on the next invoice, still prorated from
   * today, so nobody is charged at once for a seat they did not agree to,
   * and the seat is not free either. An invitation sent while seats were
   * still free, and accepted after they filled, is the common case.
   *
   * Never throws. A seat count that failed to reach Stripe is a billing
   * discrepancy worth logging and retrying; it is not a reason to fail the
   * invitation someone just accepted.
   *
   * One at a time per Organisation, under the same lock checkout takes.
   * Counting the members, reading Stripe's quantity and writing the new one
   * are separate steps, so two people joining at once could interleave
   * them: the sync that counted 11 could write after the one that counted
   * 12, leaving Stripe billing a seat short — and crediting it back at once.
   * The count is taken only once the lock is held, so whichever sync runs
   * last sees every join committed before it.
   */
  async syncToProvider(
    organisationId: string,
    { chargeNow = false }: { chargeNow?: boolean } = {},
  ): Promise<void> {
    if (!this.stripeService.isConfigured) return;

    try {
      await this.underBillingLock(organisationId, async () => {
        const subscription = await this.subscriptions.findOne({
          where: { organisationId },
        });
        if (!subscription) return;
        const { count } = await this.forOrganisation(organisationId);
        await this.pushQuantity(subscription, count, chargeNow);
      });
    } catch (error) {
      this.logger.error(
        `Failed to sync seat count for organisation ${organisationId}: ${String(error)}`,
      );
    }
  }

  /**
   * Runs `work` holding the Organisation's billing lock — the same
   * transaction-scoped advisory lock as `CheckoutService.underBillingLock`,
   * by the same key, so a seat sync also waits for a checkout in progress.
   * The transaction stays open across the Stripe calls: a second or two.
   *
   * Never call this from inside that lock: it is taken on a new connection,
   * so a caller already holding it would wait for itself.
   */
  private underBillingLock(
    organisationId: string,
    work: () => Promise<void>,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `billing:${organisationId}`,
      ]);
      await work();
    });
  }

  /**
   * Sets the quantity on the Stripe subscription's **item**, which is where
   * Stripe keeps it — the subscription itself has no quantity.
   *
   * The two directions are deliberately not symmetric (ADR 0033):
   *
   * - **Up** — `always_invoice`, so the seat is paid for as the person
   *   arrives rather than at a renewal weeks away, when an admin agreed to
   *   that (`chargeNow`). Otherwise `create_prorations`: the same prorated
   *   amount, on the next invoice.
   * - **Down** — per cycle, as before. Monthly `none`, so the smaller count
   *   lands whole on the next invoice instead of as mid-period credits to
   *   reconcile; annual `create_prorations`, leaving the credit against it.
   *
   * `pending_invoice_item_interval` stays set on annual either way: a year
   * is too long to leave any proration this path did not invoice unbilled.
   *
   * A decline does **not** throw — `invoice.payment_failed` arrives moments
   * later and emails whoever pays the bill.
   */
  private async pushQuantity(
    subscription: Subscription,
    count: number,
    chargeNow: boolean,
  ): Promise<void> {
    if (!subscription.stripeSubscriptionId) {
      this.logger.log(
        `Organisation ${subscription.organisationId} bills ${count} seat(s); no provider subscription to update yet.`,
      );
      return;
    }

    const remote = await this.stripeService.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );
    // Nothing to bill a seat on. An ended subscription cannot change, and
    // one still awaiting its first payment is replaced at checkout if the
    // count no longer matches — updating it here would raise a stray
    // invoice. Either way the purchase is already saved on our side, and
    // becomes the quantity of the next subscription.
    if (hasEnded(remote.status) || remote.status === 'incomplete') {
      this.logger.log(
        `Organisation ${subscription.organisationId} bills ${count} seat(s); its subscription is ${remote.status}, so nothing to update.`,
      );
      return;
    }
    const item = remote.items.data[0];
    if (!item) {
      this.logger.error(
        `Stripe subscription ${subscription.stripeSubscriptionId} has no items to set a quantity on.`,
      );
      return;
    }
    if (item.quantity === count) return;

    // Null quantity means Stripe never recorded one, which can only be
    // fewer seats than any count that reaches here — so treat it as a rise.
    const growing = count > (item.quantity ?? 0);
    const annual = item.price?.recurring?.interval === 'year';
    await this.stripeService.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{ id: item.id, quantity: count }],
        proration_behavior: growing
          ? chargeNow
            ? 'always_invoice'
            : 'create_prorations'
          : annual
            ? 'create_prorations'
            : 'none',
        ...(annual
          ? {
              pending_invoice_item_interval: {
                interval: 'month',
                interval_count: 1,
              },
            }
          : {}),
      },
    );
    this.logger.log(
      `Organisation ${subscription.organisationId} now bills ${count} seat(s)` +
        `${growing ? (chargeNow ? ', charged now' : ', on the next invoice') : ''}.`,
    );
  }
}
