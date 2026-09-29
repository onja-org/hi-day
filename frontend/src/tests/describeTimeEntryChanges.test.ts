import { describe, expect, it } from "vitest";
import { describeTimeEntryChanges } from "@/lib/describeTimeEntryChanges";
import type { TimeEntrySnapshot } from "@/lib/describeTimeEntryChanges";

function makeSnapshot(overrides: Partial<TimeEntrySnapshot> = {}): TimeEntrySnapshot {
  return {
    projectName: "Website",
    taskName: null,
    startedAt: "2026-01-05T09:00:00.000Z",
    endedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("describeTimeEntryChanges", () => {
  it("returns nothing when the edit changes nothing", () => {
    expect(describeTimeEntryChanges(makeSnapshot(), makeSnapshot())).toEqual([]);
  });

  it("reports only the fields that actually differ", () => {
    const changes = describeTimeEntryChanges(
      makeSnapshot(),
      makeSnapshot({ endedAt: "2026-01-05T11:00:00.000Z" }),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe("End");
  });

  it("keeps the form's field order when several change at once", () => {
    const changes = describeTimeEntryChanges(
      makeSnapshot(),
      makeSnapshot({
        projectName: "Mobile app",
        taskName: "Onboarding",
        startedAt: "2026-01-05T08:30:00.000Z",
        endedAt: "2026-01-05T11:00:00.000Z",
      }),
    );

    expect(changes.map((change) => change.label)).toEqual([
      "Project",
      "Task",
      "Start",
      "End",
    ]);
  });

  it("names the absent task rather than showing a blank", () => {
    const [change] = describeTimeEntryChanges(
      makeSnapshot({ taskName: "Onboarding" }),
      makeSnapshot({ taskName: null }),
    );

    expect(change).toMatchObject({ label: "Task", from: "Onboarding", to: "No task" });
  });

  // The entry carries ISO instants; the edit form hands back
  // `datetime-local` values. The same moment in those two spellings must
  // not read as a change.
  it("compares times as instants, not as strings", () => {
    const changes = describeTimeEntryChanges(
      makeSnapshot({ startedAt: "2026-01-05T09:00:00.000Z" }),
      makeSnapshot({ startedAt: "2026-01-05T09:00:00Z" }),
    );

    expect(changes).toEqual([]);
  });

  // A paused entry has no end until the edit sets one.
  it("names an absent end rather than leaving the change half blank", () => {
    const [change] = describeTimeEntryChanges(
      makeSnapshot({ endedAt: "" }),
      makeSnapshot({ endedAt: "2026-01-05T11:00:00.000Z" }),
    );

    expect(change).toMatchObject({ label: "End", from: "not set" });
  });

  it("falls back to the raw value when a time cannot be parsed", () => {
    const changes = describeTimeEntryChanges(
      makeSnapshot(),
      makeSnapshot({ endedAt: "not-a-date" }),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].to).toBe("not-a-date");
  });

  it("reads a cleared end as not set rather than as a blank", () => {
    const [change] = describeTimeEntryChanges(
      makeSnapshot(),
      makeSnapshot({ endedAt: "" }),
    );

    expect(change.to).toBe("not set");
  });
});
