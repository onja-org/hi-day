import { describe, expect, it } from "vitest";
import { webTimerConstraint } from "@/lib/webTimerConstraint";
import type { TimeEntry } from "@/types/timeEntry";

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "te-1",
    membershipId: "m-1",
    projectId: "p-1",
    taskId: null,
    startedAt: "2026-10-02T09:00:00.000Z",
    endedAt: null,
    source: "agent",
    deviceId: "device-a",
    pausedAt: null,
    pausedSeconds: 0,
    ...overrides,
  } as TimeEntry;
}

describe("webTimerConstraint", () => {
  it("leaves every project available when no device is tracking", () => {
    expect(webTimerConstraint(null).requiredProjectId).toBeNull();
  });

  it("pins the web to the project the device is tracking", () => {
    const constraint = webTimerConstraint(makeEntry({ projectId: "p-9" }));

    expect(constraint.requiredProjectId).toBe("p-9");
  });

  // Still pinned while paused: starting another project here and resuming
  // there would otherwise produce the split this exists to prevent.
  it("stays pinned while the device is paused", () => {
    const constraint = webTimerConstraint(
      makeEntry({ projectId: "p-9", pausedAt: "2026-10-02T09:30:00.000Z" }),
    );

    expect(constraint.requiredProjectId).toBe("p-9");
  });
});
