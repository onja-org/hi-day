import { useSyncExternalStore } from "react";

/** Half an hour. A running entry's end time is a "still going, and it's
 * about this time now" signal rather than a stopwatch, so this trades
 * precision for not re-rendering the timesheet every second. */
export const HALF_HOUR_MS = 30 * 60 * 1000;

type Clock = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => Date;
};

/**
 * One ticking clock per interval, shared by every subscriber, holding a
 * *cached* Date — `useSyncExternalStore` compares snapshots by identity, so
 * a fresh `new Date()` per read would re-render forever.
 */
function makeClock(intervalMs: number): Clock {
  let snapshot = new Date();
  let handle: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const tick = () => {
    snapshot = new Date();
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      if (handle === null) {
        // The cached Date can be hours stale by now — the module may have
        // loaded long before any running entry appeared — so re-read it.
        handle = setInterval(tick, intervalMs);
        tick();
      }
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && handle !== null) {
          clearInterval(handle);
          handle = null;
        }
      };
    },
    getSnapshot: () => snapshot,
  };
}

const clocks = new Map<number, Clock>();

function getClock(intervalMs: number): Clock {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    clock = makeClock(intervalMs);
    clocks.set(intervalMs, clock);
  }
  return clock;
}

/**
 * The current time, refreshed every `intervalMs`. `null` during server
 * rendering and hydration on purpose — a server-guessed clock would make the
 * hydrated markup disagree with the server's — so callers render a
 * clock-free fallback for that first paint.
 */
export function useNow(intervalMs: number): Date | null {
  const clock = getClock(intervalMs);
  return useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    () => null,
  );
}
