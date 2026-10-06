import { describe, expect, it } from "vitest";
import {
  hasNoErrors,
  serverMessageToField,
  validateTimeRange,
} from "@/lib/timeEntryFieldErrors";

// No trailing Z: a datetime-local input's value is local time, so the clock
// it is compared against has to be read the same way or the test passes or
// fails by the runner's timezone.
const NOW = new Date("2026-01-05T12:00");

describe("validateTimeRange", () => {
  it("accepts a span that ends after it starts and is already past", () => {
    const errors = validateTimeRange(
      "2026-01-05T09:00",
      "2026-01-05T10:00",
      NOW,
    );

    expect(hasNoErrors(errors)).toBe(true);
  });

  it("puts an end-before-start error under End", () => {
    const errors = validateTimeRange(
      "2026-01-05T10:00",
      "2026-01-05T09:00",
      NOW,
    );

    expect(errors.endedAt).toContain("after the start");
    expect(errors.startedAt).toBeUndefined();
  });

  // Equal timestamps are a zero-length entry, which the server refuses too.
  it("rejects an end equal to its start", () => {
    const errors = validateTimeRange(
      "2026-01-05T09:00",
      "2026-01-05T09:00",
      NOW,
    );

    expect(errors.endedAt).toBeDefined();
  });

  it("rejects an end in the future", () => {
    const errors = validateTimeRange(
      "2026-01-05T09:00",
      "2026-01-05T13:00",
      NOW,
    );

    expect(errors.endedAt).toContain("future");
  });

  it("asks for a missing time on the field that is missing it", () => {
    expect(validateTimeRange("", "2026-01-05T10:00", NOW).startedAt).toBeDefined();
    expect(validateTimeRange("2026-01-05T09:00", "", NOW).endedAt).toBeDefined();
  });
});

describe("serverMessageToField", () => {
  // Overlap is about the pair, so it belongs under both rather than on one.
  it("treats an overlap as a problem with the range", () => {
    const errors = serverMessageToField(
      "These times overlap time already tracked for this person. Adjust the times so they do not cover the same period.",
    );

    expect(errors.range).toBeDefined();
    expect(errors.endedAt).toBeUndefined();
  });

  it("puts the server's ordering and future rules under End", () => {
    expect(
      serverMessageToField("End time must be after the start time.").endedAt,
    ).toBeDefined();
    expect(
      serverMessageToField("End time cannot be in the future.").endedAt,
    ).toBeDefined();
  });

  // Anything unrecognised still has to be shown, just not under a time.
  it("falls back to the form for anything else", () => {
    const errors = serverMessageToField("You cannot log time on this project.");

    expect(errors.form).toBeDefined();
    expect(errors.range).toBeUndefined();
  });

  it("keeps the server's own wording rather than restating it", () => {
    const message = "These times overlap time already tracked for this person.";

    expect(serverMessageToField(message).range).toBe(message);
  });
});
