import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';

export interface PauseSpan {
  pausedAt: Date;
  /** null while this particular span is still open (currently paused). */
  resumedAt: Date | null;
}

export interface PauseState {
  /**
   * Non-null while the entry has an open pause span — the instant that
   * pause began. Callers freeze elapsed time at this instant rather than
   * continuing to count.
   */
  pausedAt: Date | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
  /** Every pause span on this entry, oldest first. */
  spans: PauseSpan[];
}

export const NO_PAUSE_STATE: PauseState = {
  pausedAt: null,
  pausedSeconds: 0,
  spans: [],
};

/**
 * Turns raw `TimeEntryPause` rows for a batch of entries into one
 * `PauseState` per entry — the single place that decides "how much was
 * this entry paused, and is it paused right now" from pause spans. Shared
 * by `TimeEntriesService`, `DashboardService`, and `RollupService` so none
 * of them can compute this independently and drift from the others.
 */
export function resolvePauseStates(
  pauses: TimeEntryPause[],
): Map<string, PauseState> {
  const byEntry = new Map<string, TimeEntryPause[]>();
  for (const pause of pauses) {
    const forEntry = byEntry.get(pause.timeEntryId) ?? [];
    forEntry.push(pause);
    byEntry.set(pause.timeEntryId, forEntry);
  }

  const states = new Map<string, PauseState>();
  for (const [timeEntryId, spans] of byEntry) {
    const open = spans.find((span) => span.resumedAt === null);
    const closedSeconds = spans
      .filter((span) => span.resumedAt !== null)
      .reduce(
        (total, span) =>
          total + (span.resumedAt!.getTime() - span.pausedAt.getTime()) / 1000,
        0,
      );
    states.set(timeEntryId, {
      pausedAt: open?.pausedAt ?? null,
      pausedSeconds: Math.round(closedSeconds),
      spans: [...spans]
        .sort((a, b) => a.pausedAt.getTime() - b.pausedAt.getTime())
        .map((span) => ({
          pausedAt: span.pausedAt,
          resumedAt: span.resumedAt,
        })),
    });
  }
  return states;
}

/**
 * Active seconds for one entry, capped at "now" (or the instant it was
 * paused, or its own `endedAt`) and net of every closed pause span — the
 * one formula every aggregate (dashboard KPIs, rollups) and the live-timer
 * display must agree on, or "today" and "yesterday" will visibly disagree
 * by a rounding artifact.
 */
export function activeSeconds(
  entry: { startedAt: Date; endedAt: Date | null },
  pauseState: PauseState,
  now: Date,
): number {
  const effectiveEnd = pauseState.pausedAt ?? entry.endedAt ?? now;
  const grossSeconds =
    (effectiveEnd.getTime() - entry.startedAt.getTime()) / 1000;
  return Math.max(0, Math.round(grossSeconds - pauseState.pausedSeconds));
}
