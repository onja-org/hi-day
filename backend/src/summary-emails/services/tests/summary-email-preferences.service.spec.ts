import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { createUnsubscribeToken } from '../../unsubscribe-token.util';
import { SummaryEmailPreferencesService } from '../summary-email-preferences.service';

const MEMBERSHIP_ID = '3f1c2a8e-5b7d-4c9a-8e2f-1a2b3c4d5e6f';

function setup(extra: Record<string, unknown> = {}) {
  const membership = {
    id: MEMBERSHIP_ID,
    userId: 'user-1',
    organisationId: 'org-1',
    role: MembershipRole.MEMBER,
    teamMemberships: [],
    personalSummaryEmails: null,
    teamSummaryEmails: null,
    summaryEmailOptOuts: [] as string[],
    organisation: { name: 'Acme', settings: {} },
    ...extra,
  };
  const memberships = { findOne: jest.fn().mockResolvedValue(membership) };
  const manager = { update: jest.fn() };
  const dataSource = {
    transaction: (work: (m: typeof manager) => Promise<void>) => work(manager),
  };
  const auditLogService = { record: jest.fn() };
  const service = new SummaryEmailPreferencesService(
    memberships as never,
    dataSource as never,
    auditLogService,
    { getOrThrow: () => 'secret' } as never,
  );
  return { service, manager, membership };
}

describe('SummaryEmailPreferencesService', () => {
  it('lists only personal summaries for a plain member', async () => {
    const { service } = setup();
    expect(await service.getOwn('org-1', 'user-1')).toEqual([
      { kind: 'personal-daily', available: false, enabled: false },
      { kind: 'personal-weekly', available: true, enabled: true },
    ]);
  });

  it('lists team summaries for an admin', async () => {
    const { service } = setup({ role: MembershipRole.ADMIN });
    const kinds = (await service.getOwn('org-1', 'user-1')).map((p) => p.kind);
    expect(kinds).toEqual([
      'personal-daily',
      'personal-weekly',
      'team-daily',
      'team-weekly',
    ]);
  });

  it('lets a member switch an email off and back on', async () => {
    const { service, manager } = setup();
    const off = await service.setOwn(
      'org-1',
      'user-1',
      'personal-weekly',
      false,
    );
    expect(off.find((p) => p.kind === 'personal-weekly')?.enabled).toBe(false);
    expect(manager.update).toHaveBeenLastCalledWith(
      expect.anything(),
      { id: MEMBERSHIP_ID },
      { summaryEmailOptOuts: ['personal-weekly'] },
    );
    const on = await service.setOwn('org-1', 'user-1', 'personal-weekly', true);
    expect(on.find((p) => p.kind === 'personal-weekly')?.enabled).toBe(true);
  });

  it("won't switch on what the admin left off", async () => {
    const { service } = setup();
    await expect(
      service.setOwn('org-1', 'user-1', 'personal-daily', true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won't touch a team summary for someone who manages nobody", async () => {
    const { service } = setup();
    await expect(
      service.setOwn('org-1', 'user-1', 'team-weekly', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('turns off exactly the email a link was made for', async () => {
    const { service, manager } = setup();
    const token = createUnsubscribeToken(
      { membershipId: MEMBERSHIP_ID, kind: 'personal-weekly' },
      'secret',
    );
    expect(await service.unsubscribe(token)).toEqual({
      kind: 'personal-weekly',
      organisationName: 'Acme',
    });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: MEMBERSHIP_ID },
      { summaryEmailOptOuts: ['personal-weekly'] },
    );
  });

  it('refuses a forged link', async () => {
    const { service } = setup();
    await expect(service.unsubscribe('not-a-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
