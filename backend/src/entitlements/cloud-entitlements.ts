import type { EntityManager } from 'typeorm';
import type { BilledSeatsService } from '../billing/services/billed-seats.service';
import type { TrialService } from '../billing/services/trial.service';
import type { Entitlements } from './entitlements';

/** Hi Day Cloud. A pass-through, so the billing services stay the only
 * place billing behaviour lives. */
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
