import { describe, expect, it } from "vitest";
import { describeSplit, midpointOf } from "@/lib/describeSplit";

const START = "2026-01-05T09:00:00.000Z";
const END = "2026-01-05T11:00:00.000Z";

describe("describeSplit", () => {
  it("divides the span at the cut", () => {
    const halves = describeSplit(START, END, "2026-01-05T10:00:00.000Z");

    expect(halves).toEqual({
      first: {
        startedAt: START,
        endedAt: "2026-01-05T10:00:00.000Z",
        seconds: 3600,
      },
      second: {
        startedAt: "2026-01-05T10:00:00.000Z",
        endedAt: END,
        seconds: 3600,
      },
    });
  });

  it("handles an off-centre cut", () => {
    const halves = describeSplit(START, END, "2026-01-05T09:30:00.000Z");

    expect(halves?.first.seconds).toBe(1800);
    expect(halves?.second.seconds).toBe(5400);
  });

  // A cut on either boundary would leave one half with no span at all, which
  // the backend rejects — better to disable the button than to send it.
  it("rejects a cut on the start boundary", () => {
    expect(describeSplit(START, END, START)).toBeNull();
  });

  it("rejects a cut on the end boundary", () => {
    expect(describeSplit(START, END, END)).toBeNull();
  });

  it("rejects a cut outside the span", () => {
    expect(describeSplit(START, END, "2026-01-05T12:00:00.000Z")).toBeNull();
    expect(describeSplit(START, END, "2026-01-05T08:00:00.000Z")).toBeNull();
  });

  it("rejects an unparseable cut, as an empty input gives", () => {
    expect(describeSplit(START, END, "")).toBeNull();
  });
});

describe("midpointOf", () => {
  it("lands halfway through the span", () => {
    expect(midpointOf(START, END)).toEqual(new Date("2026-01-05T10:00:00.000Z"));
  });

  // Whatever it returns has to be a cut describeSplit accepts, or the dialog
  // opens already invalid.
  it("gives a cut that is always valid for a span of at least two seconds", () => {
    const shortEnd = "2026-01-05T09:00:02.000Z";
    const midpoint = midpointOf(START, shortEnd).toISOString();

    expect(describeSplit(START, shortEnd, midpoint)).not.toBeNull();
  });
});
