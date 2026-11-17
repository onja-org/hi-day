import type { EntityManager } from 'typeorm';

/**
 * The seam between self-hosted Hi Day (free, no billing) and Hi Day Cloud.
 * Code that creates an organisation or accepts an invitation depends on
 * this, so it never needs to know which shape it is running in.
 */
export interface Entitlements {
  readonly billingEnabled: boolean;
  startTrial(manager: EntityManager, organisationId: string): Promise<void>;
  /**
   * Bills the Organisation for its current seat count. `chargeNow` says
   * whether a rise may be invoiced on the spot (ADR 0033), which needs an
   * admin's consent; without it a rise is billed on the next invoice.
   */
  syncSeats(
    organisationId: string,
    options?: { chargeNow?: boolean },
  ): Promise<void>;
}

export const ENTITLEMENTS = Symbol('ENTITLEMENTS');
