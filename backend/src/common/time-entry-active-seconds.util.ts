import { TimeEntry } from '../database/entities/time-entry.entity';
import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';

export interface PauseState {
  pausedAt: Date | null;
  pausedSeconds: number;
}

const NO_PAUSE_STATE: PauseState = { pausedAt: null, pausedSeconds: 0 };

/** Groups a batch of `TimeEntryPause` rows (however fetched) into one
 * `PauseState` per `timeEntryId` — an open span (`resumedAt === null`)
 * plus the summed, closed-span seconds. Shared by anything that needs to
 * net a `TimeEntry`'s active time against its pauses (`DashboardService`,
 * `RollupsService`). */
export function buildPauseStates(
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
    });
  }
  return states;
}

/** Active seconds for one entry, capped at "now" (or the instant it was
 * paused) and net of every closed pause span — same formula the frontend
 * uses to freeze a running timer's display (`useRunningTimer`). */
export function computeActiveSeconds(
  entry: TimeEntry,
  pauseStates: Map<string, PauseState>,
  now: Date,
): number {
  const pauseState = pauseStates.get(entry.id) ?? NO_PAUSE_STATE;
  const effectiveEnd = pauseState.pausedAt ?? entry.endedAt ?? now;
  const grossSeconds =
    (effectiveEnd.getTime() - entry.startedAt.getTime()) / 1000;
  return Math.max(0, Math.round(grossSeconds - pauseState.pausedSeconds));
}
