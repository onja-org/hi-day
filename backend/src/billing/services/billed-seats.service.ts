import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Subscription } from '../../database/entities/subscription.entity';
import { StripeService } from './stripe.service';

/** One person on the bill, as an admin sees them. */
export interface BilledPerson {
  membershipId: string;
  name: string | null;
  email: string;
  role: MembershipRole;
}

export interface BilledSeats {
  count: number;
  people: BilledPerson[];
}

@Injectable()
export class BilledSeatsService {
  private readonly logger = new Logger(BilledSeatsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Who the Organisation is billed for, and how many. The list and the count
   * come from one query so the two can never disagree — an admin reading
   * "14 people" above a list of thirteen names has no way to tell which is
   * wrong.
   */
  async forOrganisation(organisationId: string): Promise<BilledSeats> {
    const billed = await this.memberships.find({
      where: { organisationId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return {
      count: billed.length,
      people: billed.map((membership) => ({
        membershipId: membership.id,
        name: membership.user?.name ?? null,
        email: membership.user?.email ?? '',
        role: membership.role,
      })),
    };
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
   * Where the provider call will go. Nothing to push until a Subscription
   * carries a provider subscription id, which the checkout work adds — until
   * then the only honest thing to do is record what would have been sent.
   */
  private pushQuantity(
    subscription: Subscription,
    count: number,
  ): Promise<void> {
    this.logger.log(
      `Organisation ${subscription.organisationId} bills ${count} seat(s); no provider subscription to update yet.`,
    );
    return Promise.resolve();
  }
}
