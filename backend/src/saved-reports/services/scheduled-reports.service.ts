import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { AppEventsService } from '../../app-events/services/app-events.service';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import {
  buildAppsUrlsCsv,
  buildAppsUrlsPdf,
  buildAppsUrlsTable,
} from '../../common/apps-urls-file.util';
import type {
  AppsUrlsGrouping,
  AppsUrlsItem,
} from '../../common/apps-urls-file.util';
import {
  buildDailyTotalsCsv,
  buildDailyTotalsPdf,
  buildDailyTotalsTable,
} from '../../common/daily-totals-file.util';
import { buildReportCsv, buildReportPdf } from '../../common/report-file.util';
import { resolveReportDateRange } from '../../common/report-date-range.util';
import type { ReportDatePreset } from '../../common/report-date-range.util';
import { isScheduleDue } from '../../common/report-schedule.util';
import { isValidTimezone } from '../../common/timezone.util';
import { addDaysToKey, zonedParts } from '../../common/zoned-time.util';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { SavedReport } from '../../database/entities/saved-report.entity';
import { EmailService } from '../../email/services/email.service';
import { MembershipsService } from '../../members/services/memberships.service';
import { UrlSessionsService } from '../../url-sessions/services/url-sessions.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { TimeEntryListItem } from '../../time-entries/services/time-entries.service';

const DEFAULT_TIMEZONE = 'UTC';
const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];
// The activity API answers one day at a time, so a range is capped.
const APPS_URLS_MAX_DAYS = 31;
// Member-days, so an "all" report can't fan out into thousands of queries.
const APPS_URLS_MAX_MEMBER_DAYS = 200;

export type ScheduledRunOutcome = 'sent' | 'skipped' | 'failed';

/** "Weekly Report!" → "weekly-report", for a file name. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'report';
}

function dayKey(date: Date, zone: string): string {
  return zonedParts(date, zone).dateKey;
}

/**
 * Emails saved reports on their schedule. Every ten minutes it looks at each
 * scheduled report and sends the ones that are due (see `isScheduleDue`),
 * building the report as of that moment, on behalf of the member who saved
 * it — so what's in it, and whether it goes at all, follows that member's
 * *current* role and membership, not what they could see when they scheduled it.
 */
@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);
  // A slow run must not overlap the next tick.
  private running = false;

  constructor(
    @InjectRepository(SavedReport)
    private readonly savedReports: Repository<SavedReport>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly membershipsService: MembershipsService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly appEventsService: AppEventsService,
    private readonly urlSessionsService: UrlSessionsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendDueReports(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const scheduled = await this.savedReports.find({
        where: { schedule: Not(IsNull()), schedulePaused: false },
        relations: {
          organisation: true,
          membership: { user: true, teamMemberships: true },
        },
      });
      for (const report of scheduled) {
        try {
          await this.runOne(report, now);
        } catch (error) {
          // One broken report must not stop the rest.
          this.logger.error(
            `Scheduled report ${report.id} crashed: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async runOne(report: SavedReport, now: Date): Promise<ScheduledRunOutcome> {
    const { schedule, membership, organisation } = report;
    if (!schedule || report.schedulePaused) return 'skipped';

    const configured = organisation.settings?.timezone;
    const zone =
      typeof configured === 'string' && isValidTimezone(configured)
        ? configured
        : DEFAULT_TIMEZONE;
    if (!isScheduleDue(schedule, now, zone, report.lastSentOn)) {
      return 'skipped';
    }
    // Nothing goes out for a deactivated member or a suspended organisation,
    // and it isn't marked sent, so it resumes if they come back.
    if (
      membership.status !== MembershipStatus.ACTIVE ||
      organisation.suspendedAt
    ) {
      return 'skipped';
    }

    // Claim today before doing the work, so a second instance or an
    // overlapping run can't send the same report twice.
    const today = dayKey(now, zone);
    const claim = await this.savedReports
      .createQueryBuilder()
      .update(SavedReport)
      .set({ lastSentOn: today })
      .where('id = :id AND ("lastSentOn" IS NULL OR "lastSentOn" <> :today)', {
        id: report.id,
        today,
      })
      .execute();
    if (claim.affected !== 1) return 'skipped';

    try {
      const range = resolveReportDateRange(
        schedule.dateRange as ReportDatePreset,
        now,
        zone,
      );
      const fromKey = dayKey(range.from, zone);
      const toKey = dayKey(range.to, zone);
      const title = `${report.name} — ${fromKey} to ${toKey}`;
      const content =
        report.reportType === 'apps-and-urls'
          ? await this.buildAppsUrlsContent(
              report,
              schedule.fileType,
              title,
              fromKey,
              toKey,
            )
          : this.buildContent(
              report.reportType,
              schedule.fileType,
              title,
              await this.collectEntries(report, range),
              fromKey,
              toKey,
              zone,
            );

      const sent = await this.emailService.sendReportEmail({
        to: schedule.emails,
        subject: `Scheduled report: ${report.name}`,
        message: schedule.message,
        senderName: membership.user.name ?? membership.user.email,
        senderEmail: membership.user.email,
        organisationName: organisation.name,
        attachment: {
          filename: `${slugify(report.name)}-${dayKey(range.from, zone)}-to-${dayKey(range.to, zone)}.${schedule.fileType}`,
          content,
        },
      });
      if (!sent) throw new Error('The email provider rejected the message.');

      await this.savedReports.update(
        { id: report.id },
        { lastSentAt: now, lastError: null },
      );
      await this.dataSource.transaction(async (manager) => {
        await this.auditLogService.record(manager, {
          action: 'report.sent',
          organisationId: report.organisationId,
          actorUserId: membership.userId,
          metadata: {
            savedReportId: report.id,
            scheduled: true,
            fileType: schedule.fileType,
            recipientCount: schedule.emails.length,
          },
        });
      });
      return 'sent';
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      this.logger.error(`Scheduled report ${report.id} failed: ${message}`);
      await this.savedReports.update({ id: report.id }, { lastError: message });
      return 'failed';
    }
  }

  /**
   * The Apps & URLs report, as the report page shows it: the owner's own app
   * and website time for each day in the range, in the chosen projects.
   */
  private async buildAppsUrlsContent(
    report: SavedReport,
    fileType: 'pdf' | 'csv',
    title: string,
    fromKey: string,
    toKey: string,
  ): Promise<Buffer> {
    const { membership, organisationId } = report;
    const { filters, scope } = report.settings;
    const userId = membership.userId;

    const dateKeys: string[] = [];
    for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
      dateKeys.push(key);
    }
    if (dateKeys.length > APPS_URLS_MAX_DAYS) {
      throw new Error(
        `Choose a date range of ${APPS_URLS_MAX_DAYS} days or fewer.`,
      );
    }

    // Same scoping as collectEntries: "all" only widens while the owner is
    // still an admin or manager, and only to the members shown to them.
    const ownName = membership.user.name ?? membership.user.email;
    let members: { id: string | undefined; name: string }[] = [
      { id: undefined, name: ownName },
    ];
    if (scope === 'all' && ORG_WIDE_ROLES.includes(membership.role)) {
      const listed = await this.membershipsService.listActiveForOrganisation(
        organisationId,
        userId,
      );
      members = listed
        .filter(
          (member) =>
            (filters.memberIds.length === 0 ||
              filters.memberIds.includes(member.id)) &&
            (filters.teamIds.length === 0 ||
              member.teamIds.some((id) => filters.teamIds.includes(id))),
        )
        .map((member) => ({
          id: member.id,
          name: member.name ?? member.email,
        }));
    }
    if (dateKeys.length * members.length > APPS_URLS_MAX_MEMBER_DAYS) {
      throw new Error('Choose a shorter date range or fewer members.');
    }

    const projects = await this.projects.find({
      where: {
        organisationId,
        ...(filters.projectIds.length > 0 && { id: In(filters.projectIds) }),
      },
      select: { id: true, name: true },
    });
    const projectName = (projectId: string | null): string =>
      projects.find((project) => project.id === projectId)?.name ?? 'Untracked';
    const included = (projectId: string | null): boolean =>
      filters.projectIds.length === 0 ||
      (projectId !== null && filters.projectIds.includes(projectId));

    const items: AppsUrlsItem[] = [];
    for (const member of members) {
      for (const date of dateKeys) {
        const [apps, urls] = await Promise.all([
          member.id === undefined
            ? this.appEventsService.getMyDay(organisationId, userId, date)
            : this.appEventsService.getDayForMembership(
                organisationId,
                userId,
                member.id,
                date,
              ),
          this.urlSessionsService.getDayGroupedByUrl(
            organisationId,
            userId,
            date,
            {},
            member.id,
          ),
        ]);
        for (const bucket of apps.buckets) {
          for (const item of bucket.items) {
            if (!included(item.projectId)) continue;
            items.push({
              dateKey: date,
              projectName: projectName(item.projectId),
              memberName: member.name,
              label: item.appName,
              seconds: item.secondsSpent,
            });
          }
        }
        for (const bucket of urls.buckets) {
          for (const page of bucket.pages) {
            if (!included(page.projectId)) continue;
            items.push({
              dateKey: date,
              projectName: projectName(page.projectId),
              memberName: member.name,
              label: page.host,
              seconds: page.activeMs / 1000,
            });
          }
        }
      }
    }

    const table = buildAppsUrlsTable(
      items,
      report.settings.grouping as AppsUrlsGrouping,
    );
    return fileType === 'csv'
      ? Buffer.from(buildAppsUrlsCsv(table), 'utf-8')
      : buildAppsUrlsPdf(title, table);
  }

  private buildContent(
    reportType: string,
    fileType: 'pdf' | 'csv',
    title: string,
    entries: TimeEntryListItem[],
    fromKey: string,
    toKey: string,
    zone: string,
  ): Buffer {
    if (reportType === 'daily-totals') {
      const table = buildDailyTotalsTable(entries, fromKey, toKey, zone);
      return fileType === 'csv'
        ? Buffer.from(buildDailyTotalsCsv(table), 'utf-8')
        : buildDailyTotalsPdf(title, table);
    }
    // Time and activity and Work sessions both list each session as a row.
    return fileType === 'csv'
      ? Buffer.from(buildReportCsv(entries, zone), 'utf-8')
      : buildReportPdf(title, entries, zone);
  }

  /**
   * The entries the saved settings describe. "All" only widens beyond the
   * owner's own time while they are still an admin or manager, and then only
   * to the members the member list shows *them* — the same scoping the
   * report page uses.
   */
  private async collectEntries(
    report: SavedReport,
    range: { from: Date; to: Date },
  ): Promise<TimeEntryListItem[]> {
    const { membership, organisationId } = report;
    const { filters, scope } = report.settings;
    const userId = membership.userId;
    let entries: TimeEntryListItem[] = [];

    if (scope === 'all' && ORG_WIDE_ROLES.includes(membership.role)) {
      const members = await this.membershipsService.listActiveForOrganisation(
        organisationId,
        userId,
      );
      const included = members.filter(
        (member) =>
          (filters.memberIds.length === 0 ||
            filters.memberIds.includes(member.id)) &&
          (filters.teamIds.length === 0 ||
            member.teamIds.some((id) => filters.teamIds.includes(id))),
      );
      for (const member of included) {
        entries.push(
          ...(await this.timeEntriesService.list(
            organisationId,
            userId,
            member.id,
            range.from,
            range.to,
          )),
        );
      }
    } else {
      const ownTeamIds = membership.teamMemberships.map((team) => team.teamId);
      const onChosenTeam =
        filters.teamIds.length === 0 ||
        ownTeamIds.some((id) => filters.teamIds.includes(id));
      if (onChosenTeam) {
        entries = await this.timeEntriesService.list(
          organisationId,
          userId,
          undefined,
          range.from,
          range.to,
        );
      }
    }

    return entries
      .filter(
        (entry) =>
          filters.projectIds.length === 0 ||
          filters.projectIds.includes(entry.projectId),
      )
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }
}
