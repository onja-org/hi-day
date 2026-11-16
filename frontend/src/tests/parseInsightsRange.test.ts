import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSIGHTS_PRESET,
  parseInsightsRange,
} from "@/lib/parseInsightsRange";

describe("parseInsightsRange", () => {
  it("defaults when nothing is given", () => {
    expect(parseInsightsRange({ preset: null, from: null, to: null })).toEqual({
      preset: DEFAULT_INSIGHTS_PRESET,
      days: null,
    });
  });

  it("uses a known preset", () => {
    expect(
      parseInsightsRange({ preset: "last_month", from: null, to: null }),
    ).toEqual({ preset: "last_month", days: null });
  });

  it("ignores an unknown preset", () => {
    expect(
      parseInsightsRange({ preset: "forever", from: null, to: null }),
    ).toEqual({ preset: DEFAULT_INSIGHTS_PRESET, days: null });
  });

  it("prefers custom days over a preset", () => {
    expect(
      parseInsightsRange({
        preset: "today",
        from: "2026-03-01",
        to: "2026-03-07",
      }),
    ).toEqual({ preset: null, days: { from: "2026-03-01", to: "2026-03-07" } });
  });

  it("falls back when the days are malformed or backwards", () => {
    expect(
      parseInsightsRange({ preset: null, from: "2026-3-1", to: "2026-03-07" })
        .preset,
    ).toBe(DEFAULT_INSIGHTS_PRESET);
    expect(
      parseInsightsRange({ preset: null, from: "2026-03-07", to: "2026-03-01" })
        .preset,
    ).toBe(DEFAULT_INSIGHTS_PRESET);
  });
});
