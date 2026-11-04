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

/** Must stay a pass-through: behaviour belongs in the billing services, so
 * introducing this seam could not change what a paying customer sees. */
describe('Hi Day Cloud entitlements', () => {
  it('delegates to the billing services', async () => {
    const { entitlements, startTrial, syncToProvider } = cloud();

    await entitlements.startTrial(MANAGER, 'org-1');
    await entitlements.syncSeats('org-1');

    expect(entitlements.billingEnabled).toBe(true);
    expect(startTrial).toHaveBeenCalledWith(MANAGER, 'org-1');
    expect(syncToProvider).toHaveBeenCalledWith('org-1');
  });
});

/** Both methods doing nothing is the feature, so these assert the absence. */
describe('self-hosted entitlements', () => {
  it('does nothing, and does not fail for it', async () => {
    const entitlements = new SelfHostedEntitlements();

    expect(entitlements.billingEnabled).toBe(false);
    await expect(entitlements.startTrial()).resolves.toBeUndefined();
    await expect(entitlements.syncSeats()).resolves.toBeUndefined();
  });
});

describe('what the browser is told', () => {
  it('reports the shape, and nothing else', () => {
    expect(new PublicConfigController(cloud().entitlements).get()).toEqual({
      billingEnabled: true,
    });
    expect(
      new PublicConfigController(new SelfHostedEntitlements()).get(),
    ).toEqual({ billingEnabled: false });
  });
});
