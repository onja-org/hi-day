import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Membership } from '../../../database/entities/membership.entity';
import { DisclosureService } from '../../services/disclosure.service';
import { DeviceConsentGuard } from '../device-consent.guard';

function makeContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeDisclosureService(
  overrides: {
    membership?: Partial<Membership>;
    satisfied?: boolean;
  } = {},
) {
  const resolveActiveMembership = jest
    .fn()
    .mockResolvedValue(
      overrides.membership ?? { id: 'membership-1', disclosureRegion: null },
    );
  const isCaptureConsentSatisfied = jest
    .fn()
    .mockResolvedValue(overrides.satisfied ?? true);
  return {
    service: {
      resolveActiveMembership,
      isCaptureConsentSatisfied,
    } as unknown as DisclosureService,
    resolveActiveMembership,
    isCaptureConsentSatisfied,
  };
}

describe('DeviceConsentGuard', () => {
  it('allows the request through when consent is satisfied', async () => {
    const { service } = makeDisclosureService({ satisfied: true });
    const guard = new DeviceConsentGuard(service);

    const allowed = await guard.canActivate(
      makeContext({
        organisationId: 'org-1',
        userId: 'user-1',
        deviceId: 'device-1',
      }),
    );

    expect(allowed).toBe(true);
  });

  it('rejects the request with 403 when consent is not satisfied', async () => {
    const { service } = makeDisclosureService({ satisfied: false });
    const guard = new DeviceConsentGuard(service);

    await expect(
      guard.canActivate(
        makeContext({
          organisationId: 'org-1',
          userId: 'user-1',
          deviceId: 'device-1',
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checks consent for the caller membership’s own disclosure region', async () => {
    const { service, resolveActiveMembership, isCaptureConsentSatisfied } =
      makeDisclosureService({
        membership: { id: 'membership-1', disclosureRegion: 'FR' },
        satisfied: true,
      });
    const guard = new DeviceConsentGuard(service);

    await guard.canActivate(
      makeContext({
        organisationId: 'org-1',
        userId: 'user-1',
        deviceId: 'device-1',
      }),
    );

    expect(resolveActiveMembership).toHaveBeenCalledWith('org-1', 'user-1');
    expect(isCaptureConsentSatisfied).toHaveBeenCalledWith(
      'org-1',
      'FR',
      'device-1',
    );
  });
});
