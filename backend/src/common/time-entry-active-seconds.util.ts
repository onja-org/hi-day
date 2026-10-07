import { TimeEntry } from '../database/entities/time-entry.entity';
import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';

export interface PauseState {
  pausedAt: Date | null;
  pausedSeconds: number;
}

const NO_PAUSE_STATE: PauseState = { pausedAt: null, pausedSeconds: 0 };

/**
 * One closed span's length, never negative.
 *
 * A span that resumes before it was paused is not merely odd, it is
 * corrosive: summed unclamped it *subtracts* from paused time and so
 * inflates the entry's duration, reporting work that never happened. Such
 * rows exist — `closeOpenPause` used to stamp an entry's end onto an open
 * pause without checking it came after the pause began, which a backdated
 * stop (idle discard) makes possible. The write is guarded now; this keeps
 * the rows already written from lying.
 */
function spanSeconds(span: TimeEntryPause): number {
  return Math.max(
    0,
    (span.resumedAt!.getTime() - span.pausedAt.getTime()) / 1000,
  );
}

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
      .reduce((total, span) => total + spanSeconds(span), 0);
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
