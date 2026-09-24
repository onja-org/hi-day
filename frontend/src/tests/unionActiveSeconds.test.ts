import { describe, expect, it } from "vitest";
import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

const at = (hhmm: string) => `2026-01-01T${hhmm}:00.000Z`;

function entry(
  overrides: Partial<TimeEntryListItem> & { startedAt: string; endedAt: string | null },
): TimeEntryListItem {
  const started = Date.parse(overrides.startedAt);
  const ended = overrides.endedAt ? Date.parse(overrides.endedAt) : null;
  return {
    id: Math.random().toString(36).slice(2),
    pauses: [],
    durationSeconds: ended === null ? null : Math.round((ended - started) / 1000),
    ...overrides,
  } as TimeEntryListItem;
}

describe("unionActiveSeconds — two devices, one person", () => {
  it("counts fully overlapping devices once", () => {
    const seconds = unionActiveSeconds([
      entry({ startedAt: at("09:00"), endedAt: at("10:00") }),
      entry({ startedAt: at("09:00"), endedAt: at("10:00") }),
    ]);
    expect(seconds).toBe(3600);
  });

  it("counts partial overlap once", () => {
    const seconds = unionActiveSeconds([
      entry({ startedAt: at("09:00"), endedAt: at("10:00") }),
      entry({ startedAt: at("09:30"), endedAt: at("11:00") }),
    ]);
    expect(seconds).toBe(7200); // 09:00–11:00
  });

  it("still adds genuinely separate stretches", () => {
    const seconds = unionActiveSeconds([
      entry({ startedAt: at("09:00"), endedAt: at("10:00") }),
      entry({ startedAt: at("14:00"), endedAt: at("15:00") }),
    ]);
    expect(seconds).toBe(7200);
  });

  /**
   * The server's duration is what every other view shows and already nets
   * off pauses, so a non-overlapping set must total exactly as before.
   */
  it("leaves a non-overlapping total untouched, even when it disagrees with the timestamps", () => {
    const seconds = unionActiveSeconds([
      entry({ startedAt: at("09:00"), endedAt: at("10:00"), durationSeconds: 3000 }),
      entry({ startedAt: at("14:00"), endedAt: at("15:00"), durationSeconds: 3000 }),
    ]);
    expect(seconds).toBe(6000);
  });

  it("excludes a still-running entry", () => {
    const seconds = unionActiveSeconds([
      entry({ startedAt: at("09:00"), endedAt: null }),
    ]);
    expect(seconds).toBe(0);
  });

  it("does not subtract time one device was paused for while the other tracked", () => {
    const seconds = unionActiveSeconds([
      entry({
        startedAt: at("09:00"),
        endedAt: at("10:00"),
        durationSeconds: 2700,
        pauses: [{ pausedAt: at("09:15"), resumedAt: at("09:30") }],
      }),
      entry({ startedAt: at("09:00"), endedAt: at("10:00"), durationSeconds: 3600 }),
    ]);
    // 45min + 60min of clock time, of which 45min is shared -> 60min worked.
    expect(seconds).toBe(3600);
  });

  it("is zero for no entries", () => {
    expect(unionActiveSeconds([])).toBe(0);
  });
});
