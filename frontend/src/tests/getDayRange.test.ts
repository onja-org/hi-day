import { describe, expect, it } from "vitest";
import { getDayRange, getDayRangeDateString } from "@/lib/getDayRange";

describe("getDayRange", () => {
  it("resolves offset 0 to the anchor's own local day", () => {
    const { start, end } = getDayRange(new Date(2026, 0, 5, 15, 30));

    expect(start).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
    expect(end.getDate()).toBe(5);
    expect(end.getHours()).toBe(23);
  });

  it("navigates forward and backward by whole days via offset", () => {
    const anchor = new Date(2026, 0, 5, 12, 0);

    expect(getDayRange(anchor, 1).start).toEqual(new Date(2026, 0, 6, 0, 0, 0, 0));
    expect(getDayRange(anchor, -1).start).toEqual(new Date(2026, 0, 4, 0, 0, 0, 0));
  });
});

describe("getDayRangeDateString", () => {
  it("matches the backend's own UTC-default resolveDate for offset 0", () => {
    const anchor = new Date("2026-01-05T12:00:00.000Z");

    expect(getDayRangeDateString(anchor)).toBe(
      anchor.toISOString().slice(0, 10),
    );
  });

  it("shifts by whole UTC calendar days for a non-zero offset", () => {
    const anchor = new Date("2026-01-05T12:00:00.000Z");

    expect(getDayRangeDateString(anchor, 1)).toBe("2026-01-06");
    expect(getDayRangeDateString(anchor, -1)).toBe("2026-01-04");
  });

  it("crosses a UTC midnight boundary correctly near the edge of the day", () => {
    const anchor = new Date("2026-01-05T23:30:00.000Z");

    expect(getDayRangeDateString(anchor, 1)).toBe("2026-01-06");
  });
});
