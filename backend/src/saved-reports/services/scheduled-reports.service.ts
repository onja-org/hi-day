import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { buildReportCsv, buildReportPdf } from '../../common/report-file.util';
import { resolveReportDateRange } from '../../common/report-date-range.util';
import type { ReportDatePreset } from '../../common/report-date-range.util';
import { isScheduleDue } from '../../common/report-schedule.util';
import { isValidTimezone } from '../../common/timezone.util';
import { zonedParts } from '../../common/zoned-time.util';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { SavedReport } from '../../database/entities/saved-report.entity';
import { EmailService } from '../../email/services/email.service';
import { MembershipsService } from '../../members/services/memberships.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { TimeEntryListItem } from '../../time-entries/services/time-entries.service';

const DEFAULT_TIMEZONE = 'UTC';
const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

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
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendDueReports(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const scheduled = await this.savedReports.find({
        where: { schedule: Not(IsNull()) },
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
    if (!schedule) return 'skipped';

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
      const entries = await this.collectEntries(report, range);
      const title = `${report.name} — ${dayKey(range.from, zone)} to ${dayKey(range.to, zone)}`;
      const content =
        schedule.fileType === 'csv'
          ? Buffer.from(buildReportCsv(entries, zone), 'utf-8')
          : buildReportPdf(title, entries, zone);

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
