import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { actsAsManager } from '../../common/manager-scope.util';
import { isValidTimezone } from '../../common/timezone.util';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { SummaryEmailSend } from '../../database/entities/summary-email-send.entity';
import { EmailService } from '../../email/services/email.service';
import { MembershipsService } from '../../members/services/memberships.service';
import { resolveCanViewOwnActivity } from '../../organisations/capture-settings';
import type { WeekStart } from '../../organisations/company-profile';
import { resolveProjectsEnabled } from '../../organisations/projects-setting';
import {
  summaryEmailEnabled,
  summaryKind,
  type SummaryAudience,
  type SummaryEmailKind,
  type SummaryFrequency,
} from '../../organisations/summary-emails';
import { ManualTimeEditsService } from '../../reports/services/manual-time-edits.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import {
  buildPersonalSummaryEmail,
  buildTeamSummaryEmail,
  type SummaryEmailContent,
  type SummaryFooterLinks,
  type TeamSummaryMember,
} from '../summary-email-content.util';
import {
  dueSummaryPeriods,
  rangeInstants,
  type DueSummaryPeriod,
} from '../summary-period.util';
import {
  memberPeriodStats,
  type MemberPeriodStats,
} from '../summary-stats.util';
import { createUnsubscribeToken } from '../unsubscribe-token.util';

const DEFAULT_TIMEZONE = 'UTC';
/** At most two summary emails a second from one instance. */
const SEND_INTERVAL_MS = 500;

/** What `Organisation.settings` holds that this reads. */
interface SummarySettings {
  timezone?: string;
  weekStartsOn?: WeekStart;
  projectsEnabled?: boolean;
  membersCanViewOwnActivity?: boolean;
  personalSummaryEmails?: SummaryFrequency;
  teamSummaryEmails?: SummaryFrequency;
}

export type SummaryOutcome = 'sent' | 'skipped' | 'failed';

/** One period's numbers for one person: this period and the one before. */
interface PeriodFigures {
  stats: MemberPeriodStats;
  previousTotalSeconds: number;
}

/**
 * Per Organisation and run: figures are worked out once per person and
 * period, however many summaries (theirs, and each of their managers')
 * they appear in.
 */
class RunCache {
  readonly figures = new Map<string, Promise<PeriodFigures>>();
  readonly manualEdits = new Map<string, Promise<Map<string, number>>>();
}

/**
 * Sends the daily and weekly summary emails. Every ten minutes it looks at
 * each Organisation; once it is past 07:00 there, each person due a summary
 * for a period that just ended gets one — claimed first in
 * `summary_email_sends`, so a second instance or an overlapping run can't
 * send it again.
 */
@Injectable()
export class SummaryEmailsService {
  private readonly logger = new Logger(SummaryEmailsService.name);
  private running = false;
  private lastDeliveryAt = 0;
  private readonly frontendUrl: string;
  private readonly secret: string;

  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(SummaryEmailSend)
    private readonly sends: Repository<SummaryEmailSend>,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly membershipsService: MembershipsService,
    private readonly manualTimeEditsService: ManualTimeEditsService,
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');
    this.secret = configService.getOrThrow<string>('JWT_SECRET');
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendDueSummaries(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const organisations = await this.organisations.find({
        where: { suspendedAt: IsNull() },
      });
      for (const organisation of organisations) {
        try {
          await this.runOrganisation(organisation, now);
        } catch (error) {
          // One broken Organisation must not stop the rest.
          this.logger.error(
            `Summary emails for organisation ${organisation.id} crashed: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async runOrganisation(
    organisation: Organisation,
    now: Date,
  ): Promise<SummaryOutcome[]> {
    if (organisation.suspendedAt) return [];
    const settings = (organisation.settings ?? {}) as SummarySettings;
    const zone =
      settings.timezone && isValidTimezone(settings.timezone)
        ? settings.timezone
        : DEFAULT_TIMEZONE;
    const due = dueSummaryPeriods(
      now,
      zone,
      settings.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    );
    if (due.length === 0) return [];

    const memberships = await this.memberships.find({
      where: {
        organisationId: organisation.id,
        status: MembershipStatus.ACTIVE,
      },
      relations: { user: true, teamMemberships: true },
    });

    // Who is due what, before anything is claimed or built.
    const wanted: {
      membership: Membership;
      audience: SummaryAudience;
      due: DueSummaryPeriod;
      kind: SummaryEmailKind;
    }[] = [];
    for (const membership of memberships) {
      for (const audience of ['personal', 'team'] as const) {
        if (!this.mayReceive(membership, audience)) continue;
        for (const period of due) {
          const kind = summaryKind(audience, period.period);
          const enabled = summaryEmailEnabled(kind, {
            organisationDefault:
              audience === 'personal'
                ? settings.personalSummaryEmails
                : settings.teamSummaryEmails,
            membershipOverride:
              audience === 'personal'
                ? membership.personalSummaryEmails
                : membership.teamSummaryEmails,
            optOuts: membership.summaryEmailOptOuts,
          });
          if (enabled) {
            wanted.push({ membership, audience, due: period, kind });
          }
        }
      }
    }
    if (wanted.length === 0) return [];

    // Most ticks after the first find everything already done; one query
    // says so without trying to claim each again.
    const done = await this.sends.find({
      where: {
        organisationId: organisation.id,
        membershipId: In([...new Set(wanted.map((w) => w.membership.id))]),
        periodStart: In([...new Set(wanted.map((w) => w.due.range.fromKey))]),
      },
      select: { membershipId: true, kind: true, periodStart: true },
    });
    const doneKeys = new Set(
      done.map((s) => `${s.membershipId}|${s.kind}|${s.periodStart}`),
    );

    const cache = new RunCache();
    const outcomes: SummaryOutcome[] = [];
    for (const item of wanted) {
      const key = `${item.membership.id}|${item.kind}|${item.due.range.fromKey}`;
      if (doneKeys.has(key)) continue;
      outcomes.push(
        await this.sendOne(organisation, settings, zone, item, cache),
      );
    }
    return outcomes;
  }

  /** Team summaries go only to people who oversee somebody; nobody gets a
   * personal one for a role that doesn't track time. */
  private mayReceive(
    membership: Membership,
    audience: SummaryAudience,
  ): boolean {
    if (membership.role === MembershipRole.FINANCE) return false;
    if (audience === 'personal') return true;
    return (
      membership.role === MembershipRole.ADMIN || actsAsManager(membership)
    );
  }

  private async sendOne(
    organisation: Organisation,
    settings: SummarySettings,
    zone: string,
    item: {
      membership: Membership;
      audience: SummaryAudience;
      due: DueSummaryPeriod;
      kind: SummaryEmailKind;
    },
    cache: RunCache,
  ): Promise<SummaryOutcome> {
    const { membership, due, kind } = item;
    // Claim first: only the run whose insert lands builds and sends it.
    const claim = await this.sends
      .createQueryBuilder()
      .insert()
      .into(SummaryEmailSend)
      .values({
        organisationId: organisation.id,
        membershipId: membership.id,
        kind,
        periodStart: due.range.fromKey,
      })
      .orIgnore()
      .returning(['id'])
      .execute();
    const claimedId = (claim.raw as { id: string }[])[0]?.id;
    if (!claimedId) return 'skipped';

    try {
      const content =
        item.audience === 'personal'
          ? await this.buildPersonal(organisation, settings, zone, item, cache)
          : await this.buildTeam(organisation, zone, item, cache);
      if (!content) {
        await this.sends.update(
          { id: claimedId },
          { error: 'Nothing to report.' },
        );
        return 'skipped';
      }

      await this.paceDelivery();
      const result = await this.emailService.sendSummaryEmail({
        to: membership.user.email,
        subject: content.subject,
        html: content.html,
      });
      await this.sends.update(
        { id: claimedId },
        result.sent
          ? { sentAt: new Date(), error: null }
          : { error: (result.error ?? 'Not sent.').slice(0, 500) },
      );
      return result.sent ? 'sent' : 'failed';
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      this.logger.error(
        `Summary ${kind} for ${membership.id} failed: ${message}`,
      );
      await this.sends.update({ id: claimedId }, { error: message });
      return 'failed';
    }
  }

  /**
   * A week-start morning sends to everyone at once; back to back, that
   * outruns the mail provider's rate limit (Resend's default is a few
   * requests a second), and a refused send is not retried. Only real
   * deliveries wait — the console transport sends nothing.
   */
  private async paceDelivery(): Promise<void> {
    if (!this.emailService.isDelivering) return;
    const wait = this.lastDeliveryAt + SEND_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastDeliveryAt = Date.now();
  }

  private async buildPersonal(
    organisation: Organisation,
    settings: SummarySettings,
    zone: string,
    item: {
      membership: Membership;
      due: DueSummaryPeriod;
      kind: SummaryEmailKind;
    },
    cache: RunCache,
  ): Promise<SummaryEmailContent | null> {
    const { membership, due } = item;
    const figures = await this.figuresFor(
      organisation,
      membership,
      due,
      zone,
      cache,
    );
    // Nothing tracked, nothing to say — no "0m" email on a day off.
    if (figures.stats.totalSeconds === 0) return null;

    const edits = await this.manualEditCounts(organisation, due, zone, cache);
    return buildPersonalSummaryEmail({
      period: due.period,
      range: due.range,
      organisationName: organisation.name,
      stats: figures.stats,
      previousTotalSeconds: figures.previousTotalSeconds,
      showProjects: resolveProjectsEnabled(
        settings.projectsEnabled,
        membership.projectsEnabled,
      ),
      // Admins and team managers always see their own activity in the
      // app; everyone else per the setting, as on their dashboard.
      showActivity:
        membership.role === MembershipRole.ADMIN ||
        actsAsManager(membership) ||
        resolveCanViewOwnActivity(
          settings.membersCanViewOwnActivity,
          membership.canViewOwnActivity,
        ),
      manualEditCount: edits.get(membership.id) ?? 0,
      timesheetUrl: `${this.frontendUrl}/organisations/${organisation.publicId}/time_entries`,
      links: this.footerLinks(membership, item.kind),
    });
  }

  private async buildTeam(
    organisation: Organisation,
    zone: string,
    item: {
      membership: Membership;
      due: DueSummaryPeriod;
      kind: SummaryEmailKind;
    },
    cache: RunCache,
  ): Promise<SummaryEmailContent | null> {
    const { membership: recipient, due } = item;
    // The same people the member list shows them, scoped as it is.
    const listed = (
      await this.membershipsService.listActiveForOrganisation(
        organisation.id,
        recipient.userId,
      )
    ).filter(
      // Not the reader themself: their own time is in their personal
      // summary, and an admin who doesn't track would otherwise be flagged
      // "no time tracked" in their own email every week.
      (member) =>
        member.role !== MembershipRole.FINANCE && member.id !== recipient.id,
    );
    // A manager whose teams hold nobody else has no team to summarise.
    if (listed.length === 0) return null;

    const byId = new Map(
      (
        await this.memberships.find({
          where: {
            organisationId: organisation.id,
            id: In(listed.map((member) => member.id)),
          },
          relations: { user: true },
        })
      ).map((membership) => [membership.id, membership]),
    );
    const edits = await this.manualEditCounts(organisation, due, zone, cache);

    const members: TeamSummaryMember[] = [];
    for (const listedMember of listed) {
      const membership = byId.get(listedMember.id);
      if (!membership) continue;
      const figures = await this.figuresFor(
        organisation,
        membership,
        due,
        zone,
        cache,
      );
      members.push({
        name: listedMember.name || listedMember.email,
        stats: figures.stats,
        previousTotalSeconds: figures.previousTotalSeconds,
        manualEditCount: edits.get(membership.id) ?? 0,
      });
    }

    const total = members.reduce((sum, m) => sum + m.stats.totalSeconds, 0);
    // A quiet day (a weekend) isn't worth an email; a quiet week is.
    if (due.period === 'daily' && total === 0) return null;

    const publicId = organisation.publicId;
    return buildTeamSummaryEmail({
      period: due.period,
      range: due.range,
      organisationName: organisation.name,
      members,
      dashboardUrl: `${this.frontendUrl}/dashboard/${publicId}/all`,
      reportUrl: `${this.frontendUrl}/organisations/${publicId}/reports/daily-totals`,
      links: this.footerLinks(recipient, item.kind),
    });
  }

  /** One person's figures for a period and the one before, from a single
   * query covering both. */
  private figuresFor(
    organisation: Organisation,
    membership: Membership,
    due: DueSummaryPeriod,
    zone: string,
    cache: RunCache,
  ): Promise<PeriodFigures> {
    const key = `${membership.id}|${due.range.fromKey}|${due.range.toKey}`;
    let figures = cache.figures.get(key);
    if (!figures) {
      figures = (async () => {
        const { from } = rangeInstants(due.previous, zone);
        const { to } = rangeInstants(due.range, zone);
        // As the member themself: their own time, whoever reads it.
        const entries = await this.timeEntriesService.listAllInRange(
          organisation.id,
          membership.userId,
          undefined,
          from,
          to,
        );
        return {
          stats: memberPeriodStats(entries, due.range, zone),
          previousTotalSeconds: memberPeriodStats(entries, due.previous, zone)
            .totalSeconds,
        };
      })();
      cache.figures.set(key, figures);
    }
    return figures;
  }

  /**
   * Manual time changes per Membership in the period, read once per
   * Organisation through an admin's eyes — everyone's, unfiltered. Each
   * summary then shows only the counts for people its reader may see.
   */
  private manualEditCounts(
    organisation: Organisation,
    due: DueSummaryPeriod,
    zone: string,
    cache: RunCache,
  ): Promise<Map<string, number>> {
    const key = `${due.range.fromKey}|${due.range.toKey}`;
    let counts = cache.manualEdits.get(key);
    if (!counts) {
      counts = (async () => {
        const admin = await this.memberships.findOne({
          where: {
            organisationId: organisation.id,
            role: MembershipRole.ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        });
        const result = new Map<string, number>();
        if (!admin) return result;
        const { from, to } = rangeInstants(due.range, zone);
        const edits = await this.manualTimeEditsService.list(
          organisation.id,
          admin.userId,
          'all',
          from,
          to,
        );
        for (const edit of edits) {
          if (!edit.membershipId) continue;
          result.set(
            edit.membershipId,
            (result.get(edit.membershipId) ?? 0) + 1,
          );
        }
        return result;
      })();
      cache.manualEdits.set(key, counts);
    }
    return counts;
  }

  private footerLinks(
    membership: Membership,
    kind: SummaryEmailKind,
  ): SummaryFooterLinks {
    const token = createUnsubscribeToken(
      { membershipId: membership.id, kind },
      this.secret,
    );
    return {
      unsubscribeUrl: `${this.frontendUrl}/unsubscribe?token=${encodeURIComponent(token)}`,
      settingsUrl: `${this.frontendUrl}/account/edit`,
    };
  }
}
