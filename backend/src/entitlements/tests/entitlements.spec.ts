import type { EntityManager } from 'typeorm';
import type { BilledSeatsService } from '../../billing/services/billed-seats.service';
import type { TrialService } from '../../billing/services/trial.service';
import { CloudEntitlements } from '../cloud-entitlements';
import { PublicConfigController } from '../public-config.controller';
import { SelfHostedEntitlements } from '../self-hosted-entitlements';

const MANAGER = {} as EntityManager;

function cloud() {
  const startTrial = jest.fn().mockResolvedValue(undefined);
  const syncToProvider = jest.fn().mockResolvedValue(undefined);
  return {
    entitlements: new CloudEntitlements(
      { startTrial } as unknown as TrialService,
      { syncToProvider } as unknown as BilledSeatsService,
    ),
    startTrial,
    syncToProvider,
  };
}

/**
 * The Cloud shape must be a pass-through and nothing more. If it ever grows
 * logic of its own, that logic is untested on the path paying customers
 * actually take — the billing services are where behaviour belongs.
 */
describe('Hi Day Cloud entitlements', () => {
  it('says billing is on', () => {
    expect(cloud().entitlements.billingEnabled).toBe(true);
  });

  it('starts the trial on the caller’s transaction', async () => {
    const { entitlements, startTrial } = cloud();

    await entitlements.startTrial(MANAGER, 'org-1');

    expect(startTrial).toHaveBeenCalledWith(MANAGER, 'org-1');
  });

  it('reports the seat count to the provider', async () => {
    const { entitlements, syncToProvider } = cloud();

    await entitlements.syncSeats('org-1');

    expect(syncToProvider).toHaveBeenCalledWith('org-1');
  });
});

/**
 * Free forever, any team size. Both methods doing nothing *is* the feature,
 * so these assert the absence rather than a result.
 */
describe('self-hosted entitlements', () => {
  it('says billing is off', () => {
    expect(new SelfHostedEntitlements().billingEnabled).toBe(false);
  });

  // No Subscription row, so nothing counts down anywhere.
  it('starts no trial, and does not fail for not starting one', async () => {
    await expect(
      new SelfHostedEntitlements().startTrial(),
    ).resolves.toBeUndefined();
  });

  // Unlimited seats: nobody is charged for arriving, so there is nothing
  // to report and no provider to report it to.
  it('reports no seats', async () => {
    await expect(
      new SelfHostedEntitlements().syncSeats(),
    ).resolves.toBeUndefined();
  });

  /**
   * It must hold no payment client and read no payment configuration —
   * that is what lets the app boot with no provider set up at all.
   */
  it('carries nothing that could reach a payment provider', () => {
    const entitlements = new SelfHostedEntitlements();

    const held = Object.values(entitlements).filter(
      (value) => value !== undefined && typeof value === 'object',
    );

    // Only its logger.
    expect(held).toHaveLength(1);
  });
});

describe('what the browser is told', () => {
  it('reports billing on for Hi Day Cloud', () => {
    const controller = new PublicConfigController(cloud().entitlements);

    expect(controller.get()).toEqual({ billingEnabled: true });
  });

  it('reports billing off for a self-hosted install', () => {
    const controller = new PublicConfigController(new SelfHostedEntitlements());

    expect(controller.get()).toEqual({ billingEnabled: false });
  });

  /**
   * The one unauthenticated endpoint on the backend. A key, a provider id
   * or a customer count leaking in here would be readable by anybody who
   * can reach the server, so the shape is pinned exactly.
   */
  it('says nothing else at all', () => {
    const controller = new PublicConfigController(cloud().entitlements);

    expect(Object.keys(controller.get())).toEqual(['billingEnabled']);
  });
});
