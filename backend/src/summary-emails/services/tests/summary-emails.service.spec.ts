import { MembershipRole } from '../../../database/entities/membership-role.enum';
import type { Membership } from '../../../database/entities/membership.entity';
import type { Organisation } from '../../../database/entities/organisation.entity';
import { SummaryEmailsService } from '../summary-emails.service';

// Monday 2026-11-23, 09:00 UTC: yesterday's daily and last week's weekly
// are both due for a UTC organisation.
const NOW = new Date('2026-11-23T09:00:00Z');

const organisation = (settings: Record<string, unknown> = {}) =>
  ({
    id: 'org-1',
    publicId: 100001,
    name: 'Acme',
    settings,
    suspendedAt: null,
  }) as unknown as Organisation;

const membership = (
  id: string,
  role: MembershipRole,
  extra: Partial<Membership> = {},
) =>
  ({
    id,
    userId: `user-${id}`,
    organisationId: 'org-1',
    role,
    user: { email: `${id}@acme.test`, name: id },
    teamMemberships: [],
    personalSummaryEmails: null,
    teamSummaryEmails: null,
    summaryEmailOptOuts: [],
    projectsEnabled: null,
    canViewOwnActivity: null,
    ...extra,
  }) as unknown as Membership;

const trackedEntry = {
  id: 'e-1',
  membershipId: 'x',
  projectId: null,
  projectName: null,
  startedAt: new Date('2026-11-22T09:00:00Z'),
  endedAt: new Date('2026-11-22T10:00:00Z'),
  pauses: [],
  durationSeconds: 3600,
  activePercentage: null,
  activityCoveredSeconds: null,
};

function setup(options: {
  memberships: Membership[];
  /** Whether the claim insert lands. */
  claims?: boolean;
  entries?: unknown[];
  done?: { membershipId: string; kind: string; periodStart: string }[];
}) {
  const claimExecute = jest.fn().mockResolvedValue({
    raw: options.claims === false ? [] : [{ id: 'send-1' }],
  });
  interface Builder {
    insert: () => Builder;
    into: () => Builder;
    values: jest.Mock<Builder, [unknown]>;
    orIgnore: () => Builder;
    returning: () => Builder;
    execute: jest.Mock;
  }
  const builder: Builder = {
    insert: () => builder,
    into: () => builder,
    values: jest.fn((): Builder => builder),
    orIgnore: () => builder,
    returning: () => builder,
    execute: claimExecute,
  };
  const sends = {
    find: jest.fn().mockResolvedValue(options.done ?? []),
    createQueryBuilder: () => builder,
    update: jest.fn().mockResolvedValue(undefined),
  };
  const memberships = {
    find: jest.fn().mockResolvedValue(options.memberships),
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.memberships.find((m) => m.role === MembershipRole.ADMIN) ??
          null,
      ),
  };
  const timeEntriesService = {
    listAllInRange: jest.fn().mockResolvedValue(options.entries ?? []),
  };
  const membershipsService = {
    listActiveForOrganisation: jest.fn().mockResolvedValue(
      options.memberships.map((m) => ({
        id: m.id,
        name: m.id,
        email: `${m.id}@acme.test`,
        role: m.role,
      })),
    ),
  };
  const manualTimeEditsService = { list: jest.fn().mockResolvedValue([]) };
  const emailService = {
    isDelivering: false,
    sendSummaryEmail: jest
      .fn<
        Promise<{ sent: boolean; error: string | null }>,
        [{ to: string; subject: string }]
      >()
      .mockResolvedValue({ sent: true, error: null }),
  };
  const config = {
    getOrThrow: (key: string) =>
      key === 'FRONTEND_URL' ? 'https://app.test' : 'secret',
  };
  const service = new SummaryEmailsService(
    {} as never,
    memberships as never,
    sends as never,
    timeEntriesService as never,
    membershipsService as never,
    manualTimeEditsService as never,
    emailService as never,
    config as never,
  );
  return { service, emailService, sends, builder };
}

const sentTo = (emailService: {
  sendSummaryEmail: jest.Mock<unknown, [{ to: string; subject: string }]>;
}) =>
  emailService.sendSummaryEmail.mock.calls.map(
    ([message]) => `${message.to}: ${message.subject.split(':')[0]}`,
  );

describe('SummaryEmailsService.runOrganisation', () => {
  it('sends weekly summaries by default, and team ones only to admins and managers', async () => {
    const { service, emailService } = setup({
      memberships: [
        membership('admin', MembershipRole.ADMIN),
        membership('member', MembershipRole.MEMBER),
        membership('finance', MembershipRole.FINANCE),
      ],
      entries: [trackedEntry],
    });
    await service.runOrganisation(organisation(), NOW);
    expect(sentTo(emailService).sort()).toEqual([
      'admin@acme.test: Team week at Acme',
      'admin@acme.test: Your week at Acme',
      'member@acme.test: Your week at Acme',
    ]);
  });

  it('leaves the reader out of their own team summary', async () => {
    const { service, emailService } = setup({
      memberships: [
        membership('admin', MembershipRole.ADMIN),
        membership('member', MembershipRole.MEMBER),
      ],
      entries: [trackedEntry],
    });
    await service.runOrganisation(organisation(), NOW);
    const team = emailService.sendSummaryEmail.mock.calls
      .map(([message]) => message as { subject: string; html: string })
      .find((message) => message.subject.startsWith('Team week'));
    expect(team?.html).toContain('>member<');
    expect(team?.html).not.toContain('>admin<');
  });

  it('sends no team summary to an admin with nobody else to oversee', async () => {
    const { service, emailService } = setup({
      memberships: [membership('admin', MembershipRole.ADMIN)],
      entries: [trackedEntry],
    });
    await service.runOrganisation(organisation(), NOW);
    expect(sentTo(emailService)).toEqual([
      'admin@acme.test: Your week at Acme',
    ]);
  });

  it('sends daily ones too when the organisation turns them on', async () => {
    const { service, emailService } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [trackedEntry],
    });
    await service.runOrganisation(
      organisation({ personalSummaryEmails: 'both' }),
      NOW,
    );
    expect(sentTo(emailService).sort()).toEqual([
      'member@acme.test: Your day at Acme',
      'member@acme.test: Your week at Acme',
    ]);
  });

  it("respects an admin's override and a person's own opt-out", async () => {
    const { service, emailService } = setup({
      memberships: [
        membership('off', MembershipRole.MEMBER, {
          personalSummaryEmails: 'off',
        }),
        membership('optedout', MembershipRole.MEMBER, {
          summaryEmailOptOuts: ['personal-weekly'],
        }),
      ],
      entries: [trackedEntry],
    });
    await service.runOrganisation(organisation(), NOW);
    expect(emailService.sendSummaryEmail).not.toHaveBeenCalled();
  });

  it('skips a personal summary with no tracked time', async () => {
    const { service, emailService, sends } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [],
    });
    expect(await service.runOrganisation(organisation(), NOW)).toEqual([
      'skipped',
    ]);
    expect(emailService.sendSummaryEmail).not.toHaveBeenCalled();
    expect(sends.update).toHaveBeenCalledWith(
      { id: 'send-1' },
      { error: 'Nothing to report.' },
    );
  });

  it('sends nothing when another run already claimed it', async () => {
    const { service, emailService } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [trackedEntry],
      claims: false,
    });
    expect(await service.runOrganisation(organisation(), NOW)).toEqual([
      'skipped',
    ]);
    expect(emailService.sendSummaryEmail).not.toHaveBeenCalled();
  });

  it('does not try again once a summary is recorded', async () => {
    const { service, builder } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [trackedEntry],
      done: [
        {
          membershipId: 'member',
          kind: 'personal-weekly',
          periodStart: '2026-11-16',
        },
      ],
    });
    expect(await service.runOrganisation(organisation(), NOW)).toEqual([]);
    expect(builder.values).not.toHaveBeenCalled();
  });

  it('records a failed send and does not retry it', async () => {
    const { service, emailService, sends } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [trackedEntry],
    });
    emailService.sendSummaryEmail.mockResolvedValue({
      sent: false,
      error: 'mailbox full',
    });
    expect(await service.runOrganisation(organisation(), NOW)).toEqual([
      'failed',
    ]);
    expect(sends.update).toHaveBeenCalledWith(
      { id: 'send-1' },
      { error: 'mailbox full' },
    );
  });

  it('sends nothing before 07:00 or for a suspended organisation', async () => {
    const { service, emailService } = setup({
      memberships: [membership('member', MembershipRole.MEMBER)],
      entries: [trackedEntry],
    });
    await service.runOrganisation(
      organisation(),
      new Date('2026-11-23T06:59:00Z'),
    );
    await service.runOrganisation(
      { ...organisation(), suspendedAt: new Date() },
      NOW,
    );
    expect(emailService.sendSummaryEmail).not.toHaveBeenCalled();
  });
});
