import { describe, expect, it } from "vitest";
import { runningEntrySeconds } from "@/lib/runningEntrySeconds";
import type { RunningEntryTiming } from "@/lib/runningEntrySeconds";

function makeTiming(overrides: Partial<RunningEntryTiming> = {}): RunningEntryTiming {
  return {
    startedAt: "2026-01-05T09:00:00.000Z",
    pausedAt: null,
    pausedSeconds: 0,
    ...overrides,
  };
}

const NOW = new Date("2026-01-05T10:00:00.000Z");

describe("runningEntrySeconds", () => {
  it("counts wall-clock time since the start", () => {
    expect(runningEntrySeconds(makeTiming(), NOW)).toBe(3600);
  });

  it("subtracts time already spent paused", () => {
    expect(runningEntrySeconds(makeTiming({ pausedSeconds: 600 }), NOW)).toBe(3000);
  });

  // The point of pausing: a break must not keep accruing as work, so the
  // answer stops depending on `now` entirely.
  it("freezes at the pause instant while paused", () => {
    const paused = makeTiming({ pausedAt: "2026-01-05T09:30:00.000Z" });

    expect(runningEntrySeconds(paused, NOW)).toBe(1800);
    expect(runningEntrySeconds(paused, new Date("2026-01-05T23:00:00.000Z"))).toBe(1800);
  });

  it("still subtracts earlier pauses when currently paused", () => {
    const paused = makeTiming({
      pausedAt: "2026-01-05T09:30:00.000Z",
      pausedSeconds: 300,
    });

    expect(runningEntrySeconds(paused, NOW)).toBe(1500);
  });

  it("never returns a negative duration for a start time in the future", () => {
    const future = makeTiming({ startedAt: "2026-01-05T11:00:00.000Z" });

    expect(runningEntrySeconds(future, NOW)).toBe(0);
  });

  // Server render and first paint have no clock; a paused entry still has an
  // answer because it is measured to the pause, not to now.
  it("returns null for a ticking entry with no clock reading", () => {
    expect(runningEntrySeconds(makeTiming(), null)).toBeNull();
  });

  it("still answers for a paused entry with no clock reading", () => {
    const paused = makeTiming({ pausedAt: "2026-01-05T09:30:00.000Z" });

    expect(runningEntrySeconds(paused, null)).toBe(1800);
  });

  it("never returns a negative duration when pauses exceed the elapsed time", () => {
    expect(runningEntrySeconds(makeTiming({ pausedSeconds: 99_999 }), NOW)).toBe(0);
  });
});
