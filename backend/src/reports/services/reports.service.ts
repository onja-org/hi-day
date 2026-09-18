import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { PauseState } from '../../common/time-entry-active-seconds.util';
import {
  NO_PAUSE_STATE,
  activeSeconds,
  resolvePauseStates,
} from '../../common/time-entry-active-seconds.util';
import { Rollup } from '../../database/entities/rollup.entity';
import { RollupPeriodType } from '../../database/entities/rollup-period-type.enum';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';

export type ReportGroupBy = 'person' | 'project';

export interface ReportRow {
  /** membershipId or projectId, depending on `groupBy`. */
  key: string;
  label: string;
  seconds: number;
}

interface GroupableRecord {
  membershipId: string;
  memberName: string;
  projectId: string;
  projectName: string;
}

/**
 * Manager-facing "time by person or by project, over a date range" — the
 * actual new capability this epic asked for, on top of `RollupService`'s
 * performance rewrite. Reads `Rollup` rows for every day before today, and
 * live `TimeEntry` rows only for whatever slice of the range falls on
 * today — the same split `DashboardService` uses, generalized from "my
 * own" to the whole organisation. See `RollupPeriodType.HOUR`'s comment
 * for why finer-than-a-day granularity isn't attempted yet.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Rollup) private readonly rollups: Repository<Rollup>,
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(TimeEntryPause)
    private readonly timeEntryPauses: Repository<TimeEntryPause>,
  ) {}

  async getReport(
    organisationId: string,
    params: { groupBy: ReportGroupBy; from: Date; to: Date },
  ): Promise<ReportRow[]> {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    // Never query past "now" — a `to` date in the future would otherwise
    // ask for data that doesn't exist yet.
    const rangeEnd = params.to.getTime() < now.getTime() ? params.to : now;

    const completedTo = new Date(
      Math.min(rangeEnd.getTime(), todayStart.getTime() - 1),
    );
    const hasCompletedRange = params.from.getTime() <= completedTo.getTime();

    const liveFrom = new Date(
      Math.max(params.from.getTime(), todayStart.getTime()),
    );
    const hasLiveRange = liveFrom.getTime() <= rangeEnd.getTime();

    const [rollupRows, liveEntries] = await Promise.all([
      hasCompletedRange
        ? this.rollups.find({
            where: {
              organisationId,
              periodType: RollupPeriodType.DAY,
              periodStart: Between(params.from, completedTo),
            },
            relations: { membership: { user: true }, project: true },
          })
        : Promise.resolve([]),
      hasLiveRange
        ? this.timeEntries.find({
            where: { organisationId, startedAt: Between(liveFrom, rangeEnd) },
            relations: { membership: { user: true }, project: true },
          })
        : Promise.resolve([]),
    ]);

    const pauseStates: Map<string, PauseState> = liveEntries.length
      ? resolvePauseStates(
          await this.timeEntryPauses.find({
            where: { timeEntryId: In(liveEntries.map((entry) => entry.id)) },
          }),
        )
      : new Map<string, PauseState>();

    const totals = new Map<string, ReportRow>();
    const addSeconds = (key: string, label: string, seconds: number) => {
      const existing = totals.get(key);
      if (existing) {
        existing.seconds += seconds;
      } else {
        totals.set(key, { key, label, seconds });
      }
    };

    for (const rollup of rollupRows) {
      const { key, label } = this.groupKeyAndLabel(params.groupBy, {
        membershipId: rollup.membershipId,
        memberName: rollup.membership.user.name ?? rollup.membership.user.email,
        projectId: rollup.projectId,
        projectName: rollup.project.name,
      });
      addSeconds(key, label, rollup.workedSeconds);
    }

    for (const entry of liveEntries) {
      const seconds = activeSeconds(
        entry,
        pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
        now,
      );
      const { key, label } = this.groupKeyAndLabel(params.groupBy, {
        membershipId: entry.membershipId,
        memberName: entry.membership.user.name ?? entry.membership.user.email,
        projectId: entry.projectId,
        projectName: entry.project.name,
      });
      addSeconds(key, label, seconds);
    }

    return [...totals.values()].sort((a, b) => b.seconds - a.seconds);
  }

  private groupKeyAndLabel(
    groupBy: ReportGroupBy,
    info: GroupableRecord,
  ): { key: string; label: string } {
    return groupBy === 'person'
      ? { key: info.membershipId, label: info.memberName }
      : { key: info.projectId, label: info.projectName };
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }
}
