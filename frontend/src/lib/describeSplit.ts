/** The two spans an entry would become, with the seconds each would carry. */
export type SplitHalves = {
  first: { startedAt: string; endedAt: string; seconds: number };
  second: { startedAt: string; endedAt: string; seconds: number };
};

/**
 * What splitting an entry at `at` would produce, or `null` when `at` isn't a
 * usable cut — outside the span, on either boundary, or unparseable. Callers
 * use the null to keep the confirm disabled rather than letting the backend
 * be the first thing to say no.
 *
 * Durations here are plain wall-clock: pause spans are re-homed server-side,
 * so the seconds each half finally reports can be lower. This previews where
 * the cut lands, it isn't a promise about the resulting totals.
 */
export function describeSplit(
  startedAt: string,
  endedAt: string,
  at: string,
): SplitHalves | null {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const atMs = new Date(at).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(atMs)) {
    return null;
  }
  if (atMs <= startMs || atMs >= endMs) {
    return null;
  }

  const atIso = new Date(atMs).toISOString();
  return {
    first: {
      startedAt: new Date(startMs).toISOString(),
      endedAt: atIso,
      seconds: Math.round((atMs - startMs) / 1000),
    },
    second: {
      startedAt: atIso,
      endedAt: new Date(endMs).toISOString(),
      seconds: Math.round((endMs - atMs) / 1000),
    },
  };
}

/** The midpoint of an entry — where the split dialog opens, so the control
 * starts somewhere valid rather than on a boundary it would reject. */
export function midpointOf(startedAt: string, endedAt: string): Date {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  return new Date(startMs + Math.floor((endMs - startMs) / 2));
}
