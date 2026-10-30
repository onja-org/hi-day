import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { billedSeatCount, isOverPurchasedSeats, seatsAreFull } from '../seats';
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
    // proration each cycle needs — see `pushQuantity`.
    await this.syncToProvider(organisationId);
    return this.forOrganisation(organisationId);
  }

  /**
   * Tells the payment provider how many seats to bill for, after anything
   * that can change the number: an invitation accepted, a member removed or
   * deactivated, a role changed.
   *
   * A no-op in the three cases where there is nothing to tell: Stripe is not
   * configured (a self-hosted install, where `BILLING_ENABLED` is off and no
   * seat sync may happen at all), or the Organisation has no subscription
   * with the provider — which is every Organisation until checkout exists.
   *
   * Where the count **rose** the seats were charged for on the spot, so the
   * purchase is written up to match — otherwise the Organisation stays
   * permanently "1 over" on a bill it has already paid.
   *
   * Never throws. A seat count that failed to reach Stripe is a billing
   * discrepancy worth logging and retrying; it is not a reason to fail the
   * invitation someone just accepted.
   */
  async syncToProvider(organisationId: string): Promise<void> {
    if (!this.stripeService.isConfigured) return;

    const subscription = await this.subscriptions.findOne({
      where: { organisationId },
    });
    if (!subscription) return;

    try {
      const { count, purchasedSeats } =
        await this.forOrganisation(organisationId);
      const charged = await this.pushQuantity(subscription, count);

      // Only on a rise, and only once the charge is away. Lowering the count
      // must not quietly give back seats somebody paid to hold.
      if (charged && count > (purchasedSeats ?? 0)) {
        await this.organisations.update(
          { id: organisationId },
          { purchasedSeats: count },
        );
        this.logger.log(
          `Organisation ${organisationId} now owns ${count} seat(s), charged on arrival.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync seat count for organisation ${organisationId}: ${String(error)}`,
      );
    }
  }

  /**
   * Sets the quantity on the Stripe subscription's **item**, which is where
   * Stripe keeps it — the subscription itself has no quantity.
   *
   * The two directions are deliberately not symmetric (ADR 0033):
   *
   * - **Up** — `always_invoice`, so the seat is paid for as the person
   *   arrives rather than at a renewal weeks away. An admin ticked a box in
   *   the invite form saying this would happen.
   * - **Down** — per cycle, as before. Monthly `none`, so the smaller count
   *   lands whole on the next invoice instead of as mid-period credits to
   *   reconcile; annual `create_prorations`, leaving the credit against it.
   *
   * `pending_invoice_item_interval` stays set on annual either way: a year
   * is too long to leave any proration this path did not invoice unbilled.
   *
   * A decline does **not** throw — `invoice.payment_failed` arrives moments
   * later and emails whoever pays the bill. Answers whether a charge was
   * raised, which tells the caller the seats are now owned.
   */
  private async pushQuantity(
    subscription: Subscription,
    count: number,
  ): Promise<boolean> {
    if (!subscription.stripeSubscriptionId) {
      this.logger.log(
        `Organisation ${subscription.organisationId} bills ${count} seat(s); no provider subscription to update yet.`,
      );
      return false;
    }

    const remote = await this.stripeService.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );
    const item = remote.items.data[0];
    if (!item) {
      this.logger.error(
        `Stripe subscription ${subscription.stripeSubscriptionId} has no items to set a quantity on.`,
      );
      return false;
    }
    if (item.quantity === count) return false;

    // Null quantity means Stripe never recorded one, which can only be
    // fewer seats than any count that reaches here — so treat it as a rise.
    const growing = count > (item.quantity ?? 0);
    const annual = item.price?.recurring?.interval === 'year';
    await this.stripeService.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{ id: item.id, quantity: count }],
        proration_behavior: growing
          ? 'always_invoice'
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
        `${growing ? ', charged now' : ''}.`,
    );
    return growing;
  }
}
