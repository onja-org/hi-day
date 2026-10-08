import { DataSource, Repository } from 'typeorm';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import {
  ReportScheduleSettings,
  SavedReport,
  SavedReportSettings,
} from '../../../database/entities/saved-report.entity';
import { AppEventsService } from '../../../app-events/services/app-events.service';
import { Project } from '../../../database/entities/project.entity';
import { ManualTimeEditsService } from '../../../reports/services/manual-time-edits.service';
import { UrlSessionsService } from '../../../url-sessions/services/url-sessions.service';
import { EmailService } from '../../../email/services/email.service';
import { MembershipsService } from '../../../members/services/memberships.service';
import {
  TimeEntriesService,
  TimeEntryListItem,
} from '../../../time-entries/services/time-entries.service';
import { ScheduledReportsService } from '../scheduled-reports.service';

// Monday 28 Sep 2026, 10:15 UTC.
const NOW = new Date('2026-09-28T10:15:00Z');

const schedule: ReportScheduleSettings = {
  emails: ['boss@example.com'],
  message: 'Weekly numbers',
  fileType: 'csv',
  dateRange: 'last_week',
  frequency: 'weekly',
  hour: 9,
  days: [1],
};

const settings: SavedReportSettings = {
  datePreset: 'last_week',
  days: { from: '2026-09-21', to: '2026-09-27' },
  scope: 'me',
  grouping: 'day',
  filters: { memberIds: [], teamIds: [], projectIds: [] },
};

function entry(overrides: Partial<TimeEntryListItem> = {}): TimeEntryListItem {
  return {
    id: 'e1',
    membershipId: 'm1',
    projectId: 'p1',
    taskId: null,
    startedAt: new Date('2026-09-22T09:00:00Z'),
    endedAt: new Date('2026-09-22T10:00:00Z'),
    source: 'web',
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: 'Alpha',
    taskName: null,
    memberName: 'Ada',
    memberEmail: 'ada@example.com',
    durationSeconds: 3600,
    ...overrides,
  } as TimeEntryListItem;
}

function report(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: 'r1',
    organisationId: 'org-1',
    membershipId: 'm1',
    name: 'Weekly Report!',
    settings,
    schedule,
    lastSentOn: null,
    lastSentAt: null,
    lastError: null,
    organisation: { name: 'Acme', settings: {}, suspendedAt: null },
    membership: {
      id: 'm1',
      userId: 'u1',
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      user: { name: 'Ada', email: 'ada@example.com' },
      teamMemberships: [{ teamId: 't1' }],
    },
    ...overrides,
  } as unknown as SavedReport;
}

function setup(options: { claimed?: number; sent?: boolean } = {}) {
  const execute = jest
    .fn()
    .mockResolvedValue({ affected: options.claimed ?? 1 });
  const where = jest.fn().mockReturnValue({ execute });
  const set = jest.fn().mockReturnValue({ where });
  const queryBuilder = {
    update: jest.fn().mockReturnValue({ set }),
  };
  const update = jest.fn().mockResolvedValue(undefined);
  const find = jest.fn();
  const savedReports = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    update,
    find,
  } as unknown as Repository<SavedReport>;

  const list = jest
    .fn<
      Promise<TimeEntryListItem[]>,
      [string, string, string | undefined, Date, Date]
    >()
    .mockResolvedValue([entry()]);
  const listActiveForOrganisation = jest.fn().mockResolvedValue([
    { id: 'm1', name: 'Ada', email: 'ada@example.com', teamIds: ['t1'] },
    { id: 'm2', name: null, email: 'ben@example.com', teamIds: ['t2'] },
  ]);
  const sendReportEmail = jest.fn().mockResolvedValue(options.sent ?? true);
  const record = jest.fn().mockResolvedValue(undefined);
  const transaction = jest.fn((fn: (manager: object) => Promise<unknown>) =>
    fn({}),
  );

  const projectFind = jest
    .fn()
    .mockResolvedValue([{ id: 'p1', name: 'Alpha' }]);
  const getMyDay = jest.fn().mockResolvedValue({
    date: '2026-09-22',
    totalSecondsSpent: 600,
    buckets: [
      {
        hourStart: '2026-09-22T09:00:00Z',
        items: [
          {
            projectId: 'p1',
            appName: 'Code',
            secondsSpent: 600,
            sessionCount: 1,
          },
        ],
      },
    ],
  });
  const getDayGroupedByUrl = jest.fn().mockResolvedValue({
    date: '2026-09-22',
    totalActiveMs: 0,
    buckets: [],
  });

  const manualEdits = jest.fn().mockResolvedValue([
    {
      id: 'a1',
      action: 'add',
      membershipId: 'm1',
      memberName: 'Ada',
      memberEmail: 'ada@example.com',
      projectId: 'p1',
      projectName: 'Alpha',
      taskName: null,
      startedAt: '2026-09-22T08:00:00.000Z',
      endedAt: '2026-09-22T09:00:00.000Z',
      changeSeconds: 3600,
      reason: null,
      changedByName: 'Admin',
      changedAt: '2026-09-22T10:00:00.000Z',
    },
  ]);

  const service = new ScheduledReportsService(
    savedReports,
    { transaction } as unknown as DataSource,
    { list } as unknown as TimeEntriesService,
    { listActiveForOrganisation } as unknown as MembershipsService,
    { sendReportEmail } as unknown as EmailService,
    { record },
    { find: projectFind } as unknown as Repository<Project>,
    { getMyDay, getDayForMembership: getMyDay } as unknown as AppEventsService,
    { getDayGroupedByUrl } as unknown as UrlSessionsService,
    { list: manualEdits } as unknown as ManualTimeEditsService,
  );
  return {
    service,
    set,
    update,
    find,
    list,
    listActiveForOrganisation,
    sendReportEmail,
    record,
    getMyDay,
    manualEdits,
  };
}

describe('ScheduledReportsService', () => {
  describe('runOne', () => {
    it('sends a due report as an attachment on behalf of its owner', async () => {
      const { service, sendReportEmail, update, record } = setup();

      expect(await service.runOne(report(), NOW)).toBe('sent');

      expect(sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['boss@example.com'],
          subject: 'Scheduled report: Weekly Report!',
          message: 'Weekly numbers',
          senderEmail: 'ada@example.com',
          organisationName: 'Acme',
          attachment: expect.objectContaining({
            filename: 'weekly-report-2026-09-21-to-2026-09-27.csv',
          }) as object,
        }),
      );
      expect(update).toHaveBeenCalledWith(
        { id: 'r1' },
        { lastSentAt: NOW, lastError: null },
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'report.sent' }),
      );
    });

    it('builds an apps and URLs report from each day of the range', async () => {
      const { service, sendReportEmail, getMyDay, list } = setup();

      const apps = report({
        reportType: 'apps-and-urls',
        settings: { ...settings, grouping: 'day' },
      });
      expect(await service.runOne(apps, NOW)).toBe('sent');

      expect(getMyDay).toHaveBeenCalledTimes(7);
      expect(list).not.toHaveBeenCalled();
      expect(sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachment: expect.objectContaining({
            filename: 'weekly-report-2026-09-21-to-2026-09-27.csv',
          }) as object,
        }),
      );
    });

    it('builds an all-members apps and URLs report for an admin owner', async () => {
      const { service, getMyDay, listActiveForOrganisation } = setup();

      const admin = report({
        reportType: 'apps-and-urls',
        settings: { ...settings, grouping: 'member', scope: 'all' },
      });
      admin.membership.role = MembershipRole.ADMIN;
      expect(await service.runOne(admin, NOW)).toBe('sent');

      expect(listActiveForOrganisation).toHaveBeenCalled();
      // Two listed members, seven days each.
      expect(getMyDay).toHaveBeenCalledTimes(14);
    });

    it("keeps a non-admin owner's all-scope apps and URLs report to their own activity", async () => {
      const { service, getMyDay, listActiveForOrganisation } = setup();

      const member = report({
        reportType: 'apps-and-urls',
        settings: { ...settings, grouping: 'member', scope: 'all' },
      });
      expect(await service.runOne(member, NOW)).toBe('sent');

      expect(listActiveForOrganisation).not.toHaveBeenCalled();
      expect(getMyDay).toHaveBeenCalledTimes(7);
    });

    it('lists each session for a work sessions report, from time entries', async () => {
      const { service, sendReportEmail, list } = setup();

      const sessions = report({ reportType: 'work-sessions' });
      expect(await service.runOne(sessions, NOW)).toBe('sent');

      expect(list).toHaveBeenCalled();
      expect(sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachment: expect.objectContaining({
            filename: 'weekly-report-2026-09-21-to-2026-09-27.csv',
          }) as object,
        }),
      );
    });

    it("lists the owner's own edits for a manual time edits report", async () => {
      const { service, sendReportEmail, manualEdits } = setup();

      const edits = report({ reportType: 'manual-time-edits' });
      expect(await service.runOne(edits, NOW)).toBe('sent');

      expect(manualEdits).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'me',
        expect.any(Date),
        expect.any(Date),
      );
      expect(sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachment: expect.objectContaining({
            filename: 'weekly-report-2026-09-21-to-2026-09-27.csv',
          }) as object,
        }),
      );
    });

    it("keeps a non-admin owner's all-scope manual time edits report to their own edits", async () => {
      const { service, manualEdits } = setup();

      const member = report({
        reportType: 'manual-time-edits',
        settings: { ...settings, scope: 'all' },
      });
      await service.runOne(member, NOW);

      expect(manualEdits).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'me',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('claims the local day before sending', async () => {
      const { service, set } = setup();
      await service.runOne(report(), NOW);
      expect(set).toHaveBeenCalledWith({ lastSentOn: '2026-09-28' });
    });

    it('does nothing when it is not due', async () => {
      const { service, sendReportEmail, set } = setup();

      const early = new Date('2026-09-28T08:00:00Z');
      expect(await service.runOne(report(), early)).toBe('skipped');
      expect(set).not.toHaveBeenCalled();
      expect(sendReportEmail).not.toHaveBeenCalled();
    });

    it('does nothing once it has already gone out today', async () => {
      const { service, sendReportEmail } = setup();

      expect(
        await service.runOne(report({ lastSentOn: '2026-09-28' }), NOW),
      ).toBe('skipped');
      expect(sendReportEmail).not.toHaveBeenCalled();
    });

    it('does not send if another run claimed the day first', async () => {
      const { service, sendReportEmail } = setup({ claimed: 0 });

      expect(await service.runOne(report(), NOW)).toBe('skipped');
      expect(sendReportEmail).not.toHaveBeenCalled();
    });

    it('skips, without claiming, a deactivated member', async () => {
      const { service, set, sendReportEmail } = setup();
      const deactivated = report();
      deactivated.membership.status = MembershipStatus.DEACTIVATED;

      expect(await service.runOne(deactivated, NOW)).toBe('skipped');
      expect(set).not.toHaveBeenCalled();
      expect(sendReportEmail).not.toHaveBeenCalled();
    });

    it('skips a suspended organisation', async () => {
      const { service, sendReportEmail } = setup();
      const suspended = report();
      suspended.organisation.suspendedAt = new Date();

      expect(await service.runOne(suspended, NOW)).toBe('skipped');
      expect(sendReportEmail).not.toHaveBeenCalled();
    });

    it('reads "due" on the organisation clock', async () => {
      const { service, sendReportEmail } = setup();
      const nairobi = report();
      nairobi.organisation.settings = { timezone: 'Africa/Nairobi' };

      // 06:15 UTC is 09:15 in Nairobi: due there, not in UTC.
      const instant = new Date('2026-09-28T06:15:00Z');
      expect(await service.runOne(nairobi, instant)).toBe('sent');
      expect(sendReportEmail).toHaveBeenCalledTimes(1);
    });

    it('records the failure, and keeps the day claimed, when the email is rejected', async () => {
      const { service, update } = setup({ sent: false });

      expect(await service.runOne(report(), NOW)).toBe('failed');
      expect(update).toHaveBeenCalledWith(
        { id: 'r1' },
        { lastError: 'The email provider rejected the message.' },
      );
    });

    it('builds a PDF when that is the chosen type', async () => {
      const { service, sendReportEmail } = setup();
      const pdf = report({ schedule: { ...schedule, fileType: 'pdf' } });

      await service.runOne(pdf, NOW);

      const [[email]] = sendReportEmail.mock.calls as [
        [{ attachment: { filename: string; content: Buffer } }],
      ];
      expect(email.attachment.filename.endsWith('.pdf')).toBe(true);
      expect(email.attachment.content.subarray(0, 5).toString('latin1')).toBe(
        '%PDF-',
      );
    });

    it('covers the preset relative to now, in the organisation zone', async () => {
      const { service, list } = setup();
      await service.runOne(report(), NOW);

      const [, , , from, to] = list.mock.calls[0];
      expect(from.toISOString()).toBe('2026-09-21T00:00:00.000Z');
      expect(to.toISOString()).toBe('2026-09-27T23:59:59.999Z');
    });
  });

  describe('which entries it reports on', () => {
    it("uses only the owner's own time for 'me'", async () => {
      const { service, list, listActiveForOrganisation } = setup();
      await service.runOne(report(), NOW);

      expect(list).toHaveBeenCalledTimes(1);
      expect(list.mock.calls[0][2]).toBeUndefined();
      expect(listActiveForOrganisation).not.toHaveBeenCalled();
    });

    it("widens 'all' to the members the owner may see, when they are an admin", async () => {
      const { service, list, listActiveForOrganisation } = setup();
      const admin = report({ settings: { ...settings, scope: 'all' } });
      admin.membership.role = MembershipRole.ADMIN;

      await service.runOne(admin, NOW);

      expect(listActiveForOrganisation).toHaveBeenCalledWith('org-1', 'u1');
      expect(list.mock.calls.map((call) => call[2])).toEqual(['m1', 'm2']);
    });

    it("does not widen 'all' for someone who is no longer an admin or manager", async () => {
      const { service, list, listActiveForOrganisation } = setup();
      const demoted = report({ settings: { ...settings, scope: 'all' } });
      demoted.membership.role = MembershipRole.MEMBER;

      await service.runOne(demoted, NOW);

      expect(listActiveForOrganisation).not.toHaveBeenCalled();
      expect(list).toHaveBeenCalledTimes(1);
      expect(list.mock.calls[0][2]).toBeUndefined();
    });

    it('applies the member and team filters to the members it fetches', async () => {
      const { service, list } = setup();
      const filtered = report({
        settings: {
          ...settings,
          scope: 'all',
          filters: { memberIds: [], teamIds: ['t2'], projectIds: [] },
        },
      });
      filtered.membership.role = MembershipRole.MANAGER;

      await service.runOne(filtered, NOW);

      expect(list.mock.calls.map((call) => call[2])).toEqual(['m2']);
    });

    it('fetches nothing for a team the owner is not on', async () => {
      const { service, list, sendReportEmail } = setup();
      const other = report({
        settings: {
          ...settings,
          filters: { memberIds: [], teamIds: ['t9'], projectIds: [] },
        },
      });

      await service.runOne(other, NOW);

      expect(list).not.toHaveBeenCalled();
      expect(sendReportEmail).toHaveBeenCalled();
    });

    it('applies the project filter to the entries', async () => {
      const { service, list, sendReportEmail } = setup();
      list.mockResolvedValue([
        entry({ id: 'a', projectId: 'p1', projectName: 'Keep' }),
        entry({ id: 'b', projectId: 'p2', projectName: 'Drop' }),
      ]);
      const filtered = report({
        settings: {
          ...settings,
          filters: { memberIds: [], teamIds: [], projectIds: ['p1'] },
        },
      });

      await service.runOne(filtered, NOW);

      const [[email]] = sendReportEmail.mock.calls as [
        [{ attachment: { content: Buffer } }],
      ];
      const csv = email.attachment.content.toString('utf-8');
      expect(csv).toContain('Keep');
      expect(csv).not.toContain('Drop');
    });
  });

  describe('sendDueReports', () => {
    it('runs every scheduled report and survives one that crashes', async () => {
      const { service, find, sendReportEmail } = setup();
      const broken = report({ id: 'broken' });
      broken.organisation = undefined as never;
      find.mockResolvedValue([broken, report()]);

      await service.sendDueReports(NOW);

      expect(sendReportEmail).toHaveBeenCalledTimes(1);
    });
  });
});
