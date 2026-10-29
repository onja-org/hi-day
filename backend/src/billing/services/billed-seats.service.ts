import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import {
  billedSeatCount,
  isOverPurchasedSeats,
  needsOverageAcknowledgement,
} from '../seats';
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
   * Over the seats, and an admin has not said they understand what that
   * means for the next invoice. Drives the consent banner on the Members
   * page — see `needsOverageAcknowledgement`.
   */
  needsOverageAcknowledgement: boolean;
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
      needsOverageAcknowledgement: needsOverageAcknowledgement(
        purchasedSeats,
        memberCount,
        organisation?.seatsOverageAcknowledgedAtMembers ?? null,
      ),
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
   * Records that an admin has read what going over their seats means.
   *
   * Stamped with the member count at the time, so growing further asks
   * again — and so an acknowledgement can never be read as blanket consent
   * to any future bill.
   */
  async acknowledgeOverage(organisationId: string): Promise<BilledSeats> {
    const { memberCount } = await this.forOrganisation(organisationId);
    await this.organisations.update(
      { id: organisationId },
      { seatsOverageAcknowledgedAtMembers: memberCount },
    );
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
      const { count } = await this.forOrganisation(organisationId);
      await this.pushQuantity(subscription, count);
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
   * Proration differs by cycle, and this is the only path that pushes a
   * quantity, so it has to carry both:
   *
   * - **Monthly** — `none`. The new count lands on the next invoice whole,
   *   rather than as a scatter of mid-period credits to reconcile.
   * - **Annual** — `create_prorations`, plus `pending_invoice_item_interval`
   *   of a month, so the part-year charge for extra seats is invoiced at the
   *   next monthly anniversary instead of sitting unbilled until the year
   *   turns over.
   *
   * Nothing to push until checkout has happened, which is every Organisation
   * on a trial — then the only honest thing is to record what would have
   * been sent.
   */
  private async pushQuantity(
    subscription: Subscription,
    count: number,
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
    const item = remote.items.data[0];
    if (!item) {
      this.logger.error(
        `Stripe subscription ${subscription.stripeSubscriptionId} has no items to set a quantity on.`,
      );
      return;
    }
    if (item.quantity === count) return;

    const annual = item.price?.recurring?.interval === 'year';
    await this.stripeService.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{ id: item.id, quantity: count }],
        proration_behavior: annual ? 'create_prorations' : 'none',
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
      `Organisation ${subscription.organisationId} now bills ${count} seat(s).`,
    );
  }
}
