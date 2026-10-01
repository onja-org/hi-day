import { describe, expect, it } from "vitest";
import { getCustomDateRange } from "@/lib/getCustomDateRange";

describe("getCustomDateRange", () => {
  const NAIROBI = "Africa/Nairobi"; // UTC+3
  const NEW_YORK = "America/New_York"; // UTC-5 in January

  it("resolves the same days to different instants in different zones", () => {
    const nairobi = getCustomDateRange("2026-01-05", "2026-01-07", NAIROBI);
    const newYork = getCustomDateRange("2026-01-05", "2026-01-07", NEW_YORK);

    expect(nairobi.from.toISOString()).toBe("2026-01-04T21:00:00.000Z");
    expect(newYork.from.toISOString()).toBe("2026-01-05T05:00:00.000Z");
  });

  it("ends on the last millisecond of the final day", () => {
    const range = getCustomDateRange("2026-01-05", "2026-01-07", NAIROBI);

    expect(range.to.toISOString()).toBe("2026-01-07T20:59:59.999Z");
  });

  it("covers a single day when both ends are the same", () => {
    const range = getCustomDateRange("2026-01-05", "2026-01-05", NEW_YORK);

    expect(range.from.toISOString()).toBe("2026-01-05T05:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-06T04:59:59.999Z");
  });

  it("spans a daylight-saving change without losing or gaining a day", () => {
    // US clocks go forward on 2026-03-08, so this is 24 + 23 + 24 hours.
    const range = getCustomDateRange("2026-03-07", "2026-03-09", NEW_YORK);

    expect(range.from.toISOString()).toBe("2026-03-07T05:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-10T03:59:59.999Z");
    expect(
      Math.round((range.to.getTime() + 1 - range.from.getTime()) / 3_600_000),
    ).toBe(71);
  });
});
