import type { EntityManager } from 'typeorm';

/**
 * The seam between self-hosted Hi Day (free, no billing) and Hi Day Cloud.
 * Code that creates an organisation or accepts an invitation depends on
 * this, so it never needs to know which shape it is running in.
 */
export interface Entitlements {
  readonly billingEnabled: boolean;
  startTrial(manager: EntityManager, organisationId: string): Promise<void>;
  syncSeats(organisationId: string): Promise<void>;
}

export const ENTITLEMENTS = Symbol('ENTITLEMENTS');
