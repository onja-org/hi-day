import { describe, expect, it } from "vitest";
import {
  entryEditBlockedReason,
  entrySplitBlockedReason,
} from "@/lib/entryEditBlockedReason";

const FINISHED = { canEdit: true, endedAt: "2026-01-05T10:00:00.000Z", pausedAt: null };
const RUNNING = { canEdit: true, endedAt: null, pausedAt: null };
const PAUSED = { canEdit: true, endedAt: null, pausedAt: "2026-01-05T09:30:00.000Z" };

describe("entryEditBlockedReason", () => {
  it("allows a finished entry", () => {
    expect(entryEditBlockedReason(FINISHED)).toBeUndefined();
  });

  it("blocks a viewer who cannot edit", () => {
    expect(entryEditBlockedReason({ ...FINISHED, canEdit: false })).toContain("Modify time");
  });

  it("blocks an entry whose timer is still ticking", () => {
    expect(entryEditBlockedReason(RUNNING)).toContain("Stop the timer");
  });

  // Nothing accrues while paused, so its project, task and start are as
  // settled as a finished entry's.
  it("allows a paused entry", () => {
    expect(entryEditBlockedReason(PAUSED)).toBeUndefined();
  });

  it("reports the permission first when both block it", () => {
    expect(entryEditBlockedReason({ ...RUNNING, canEdit: false })).toContain("Modify time");
  });
});

describe("entrySplitBlockedReason", () => {
  it("allows a finished entry", () => {
    expect(entrySplitBlockedReason(FINISHED)).toBeUndefined();
  });

  // Stricter than editing: a cut needs both ends, and a paused entry has no
  // more of an end than a running one.
  it("blocks a paused entry as well as a running one", () => {
    expect(entrySplitBlockedReason(PAUSED)).toContain("Stop the timer");
    expect(entrySplitBlockedReason(RUNNING)).toContain("Stop the timer");
  });

  it("blocks a viewer who cannot edit", () => {
    expect(entrySplitBlockedReason({ ...FINISHED, canEdit: false })).toContain("Modify time");
  });
});
