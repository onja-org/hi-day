import { describe, expect, it } from "vitest";
import { idleShareLabel } from "@/lib/idleShareLabel";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(overrides: Partial<TimeEntryListItem>): TimeEntryListItem {
  return {
    type: "resumed",
    idleSeconds: null,
    durationSeconds: 2400,
    ...overrides,
  } as TimeEntryListItem;
}

describe("idleShareLabel", () => {
  it("says nothing for an entry with no kept idle time", () => {
    expect(idleShareLabel(entry({ idleSeconds: null }))).toBeNull();
  });

  it("gives the duration and its share of the entry", () => {
    expect(
      idleShareLabel(entry({ idleSeconds: 1200, durationSeconds: 2400 })),
    ).toBe("Idle 00:20:00 (50%)");
  });

  // A running entry has no duration yet, so there is no share to take —
  // the amount kept is still worth showing.
  it("drops the share while the entry is still running", () => {
    expect(
      idleShareLabel(entry({ idleSeconds: 1200, durationSeconds: null })),
    ).toBe("Idle 00:20:00");
  });

  it("says nothing for a backend that sends no idle time at all", () => {
    expect(idleShareLabel(entry({ idleSeconds: undefined }))).toBeNull();
  });
});
