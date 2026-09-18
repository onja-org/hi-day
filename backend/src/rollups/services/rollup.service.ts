import { Injectable } from '@nestjs/common';
import { Between, EntityManager, In } from 'typeorm';
import {
  NO_PAUSE_STATE,
  activeSeconds,
  resolvePauseStates,
} from '../../common/time-entry-active-seconds.util';
import { RollupPeriodType } from '../../database/entities/rollup-period-type.enum';
import { Rollup } from '../../database/entities/rollup.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecomputeDayInput {
  organisationId: string;
  membershipId: string;
  projectId: string;
  /** Any instant within the local day to recompute — only its calendar
   * date matters. */
  day: Date;
}

/**
 * Keeps `Rollup` rows in sync with `TimeEntry`/`TimeEntryPause`. There is
 * deliberately no cron-only path to correctness here: `TimeEntriesService`
 * calls `recomputeDay` inside the same transaction as every mutation that
 * could change a day's total (start/stop/switch/pause/resume, manual
 * create/edit, idle backdating, the day-boundary split) — a manager can
 * edit an arbitrary past day with no time limit (ADR-0007), so a cron that
 * only finalizes each day once, after it ends, would silently drift from
 * raw data the moment anyone edited history. A nightly cron still exists
 * as the normal-close path for days nobody touches again, not as the only
 * path to correctness.
 */
@Injectable()
export class RollupService {
  /**
   * Recomputes one (membershipId, projectId, day) row from raw entries —
   * an unconditional upsert, never a partial update, so the row is either
   * fully correct or absent, never half-updated. Must run inside the
   * caller's own transaction: if that transaction rolls back, this upsert
   * has to roll back with it, or a rollup could reflect a mutation that
   * never actually committed.
   *
   * Safe to call for "today" — it just reflects today's state as of right
   * now. A caller needing today's true live total still has to add
   * whatever's ticked since this call, exactly as `DashboardService`
   * already does for a still-running entry; this method never claims to
   * be that live total itself.
   */
  async recomputeDay(
    manager: EntityManager,
    input: RecomputeDayInput,
  ): Promise<void> {
    const dayStart = startOfLocalDay(input.day);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const entries = await manager.find(TimeEntry, {
      where: {
        membershipId: input.membershipId,
        projectId: input.projectId,
        // Entries never span a day boundary — the day-boundary-split cron
        // guarantees it — so this is exactly "this day's entries," no
        // window-clipping needed (see RollupPeriodType.HOUR's comment for
        // why that guarantee doesn't extend to hour buckets).
        startedAt: Between(dayStart, new Date(dayEnd.getTime() - 1)),
      },
    });

    const pauses = entries.length
      ? await manager.find(TimeEntryPause, {
          where: { timeEntryId: In(entries.map((entry) => entry.id)) },
        })
      : [];
    const pauseStates = resolvePauseStates(pauses);

    const now = new Date();
    const workedSeconds = entries.reduce(
      (total, entry) =>
        total +
        activeSeconds(entry, pauseStates.get(entry.id) ?? NO_PAUSE_STATE, now),
      0,
    );

    await manager.upsert(
      Rollup,
      {
        organisationId: input.organisationId,
        membershipId: input.membershipId,
        projectId: input.projectId,
        periodType: RollupPeriodType.DAY,
        periodStart: dayStart,
        workedSeconds,
      },
      {
        conflictPaths: [
          'membershipId',
          'projectId',
          'periodType',
          'periodStart',
        ],
      },
    );
  }
}

function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
