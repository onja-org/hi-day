/** The fields an unstopped entry's elapsed time is derived from. */
export type RunningEntryTiming = {
  startedAt: string;
  /** Non-null while the entry sits in an open pause span. */
  pausedAt: string | null;
  /** Seconds already spent in *closed* pause spans. */
  pausedSeconds: number;
};

/**
 * How long an unstopped entry has actually been running: wall-clock elapsed
 * minus time spent paused.
 *
 * While paused the answer ignores `now` — it is frozen at the instant the
 * pause began, so a break never accrues as work. That also means a paused
 * entry still has an answer when `now` is null, which it is until a clock
 * reading exists (server render and first paint — see `useNow`); a ticking
 * one has nothing to measure to, and returns null.
 *
 * Never negative: a device clock behind the server's, or a start nudged into
 * the future by an edit, would otherwise render as a negative duration.
 */
export function runningEntrySeconds(
  entry: RunningEntryTiming,
  now: Date | null,
): number | null {
  const upTo = entry.pausedAt ? new Date(entry.pausedAt) : now;
  if (!upTo) {
    return null;
  }
  const elapsed = upTo.getTime() - new Date(entry.startedAt).getTime();
  return Math.max(0, Math.floor(elapsed / 1000) - entry.pausedSeconds);
}
