import type { EntityManager } from 'typeorm';
import type { BilledSeatsService } from '../billing/services/billed-seats.service';
import type { TrialService } from '../billing/services/trial.service';
import type { Entitlements } from './entitlements';

/**
 * Hi Day Cloud: every new Organisation gets a trial, and every change to
 * the member count reaches Stripe.
 *
 * A thin pass-through on purpose. The behaviour lives where it always has —
 * `TrialService` and `BilledSeatsService` — so introducing this seam
 * changed no billing logic and cannot have changed what a paying customer
 * experiences. All it does is give the self-hosted shape somewhere to be.
 */
export class CloudEntitlements implements Entitlements {
  readonly billingEnabled = true;

  constructor(
    private readonly trials: TrialService,
    private readonly seats: BilledSeatsService,
  ) {}

  async startTrial(
    manager: EntityManager,
    organisationId: string,
  ): Promise<void> {
    await this.trials.startTrial(manager, organisationId);
  }

  async syncSeats(organisationId: string): Promise<void> {
    await this.seats.syncToProvider(organisationId);
  }
}
