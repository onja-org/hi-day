import type { EntityManager } from 'typeorm';

/**
 * What an installation is entitled to do about money.
 *
 * Hi Day ships as one codebase in two shapes: a self-hosted install, which
 * is free forever for any team size, and Hi Day Cloud, which charges per
 * seat. Everything else about them is identical. This is the seam between
 * the two — the one interface the rest of the app talks to, so that code
 * which merely *creates an organisation* or *accepts an invitation* never
 * has to know which shape it is running in.
 *
 * Without it, every caller would carry its own `if (billing)` branch and
 * the self-hosted path would be the one nobody runs. With it there are
 * exactly two implementations, both covered by tests, and the branch is
 * taken once at start-up.
 *
 * Deliberately narrow: only the operations that non-billing code actually
 * triggers. Anything an admin does *inside* the Billing pages belongs to
 * `BillingModule`, which simply is not loaded when billing is off.
 */
export interface Entitlements {
  /**
   * Whether this installation bills anybody. Read by the public config
   * endpoint so the browser can hide what does not exist, and by nothing
   * that makes a decision — the decisions are the methods below.
   */
  readonly billingEnabled: boolean;

  /**
   * Starts the free trial that a new Organisation is created with, on the
   * caller's transaction so the two land together or not at all.
   *
   * A self-hosted install starts none: the 14 days are a countdown to
   * paying, and there is nothing to count down to.
   */
  startTrial(manager: EntityManager, organisationId: string): Promise<void>;

  /**
   * Tells the payment provider how many seats to bill for, after anything
   * that changes the count: an invitation accepted, a member removed,
   * deactivated or given a different role.
   *
   * A self-hosted install has unlimited seats and no provider, so this does
   * nothing. Never throws in either shape — a billing discrepancy is worth
   * logging and retrying, and is never a reason to fail the invitation
   * somebody just accepted.
   */
  syncSeats(organisationId: string): Promise<void>;
}

/**
 * Injection token. An interface does not survive to runtime, so the
 * container needs something it can key on.
 */
export const ENTITLEMENTS = Symbol('ENTITLEMENTS');
