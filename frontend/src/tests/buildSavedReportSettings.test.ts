import { describe, expect, it } from "vitest";
import { buildSavedReportSettings } from "@/lib/buildSavedReportSettings";
import { EMPTY_REPORT_FILTERS } from "@/lib/reportFilters";

describe("buildSavedReportSettings", () => {
  it("keeps the page's choices and turns the range into day keys in the zone", () => {
    const settings = buildSavedReportSettings({
      preset: "last_7_days",
      range: {
        from: new Date("2026-10-04T23:00:00.000Z"),
        to: new Date("2026-10-11T21:59:59.999Z"),
      },
      zone: "Europe/Paris",
      scope: "all",
      grouping: "day",
      filters: EMPTY_REPORT_FILTERS,
    });
    expect(settings).toEqual({
      datePreset: "last_7_days",
      days: { from: "2026-10-05", to: "2026-10-11" },
      scope: "all",
      grouping: "day",
      filters: EMPTY_REPORT_FILTERS,
    });
  });

  it("keeps a null preset for a custom range", () => {
    const settings = buildSavedReportSettings({
      preset: null,
      range: { from: new Date("2026-10-05T12:00:00.000Z"), to: new Date("2026-10-05T13:00:00.000Z") },
      zone: "UTC",
      scope: "me",
      grouping: "week",
      filters: EMPTY_REPORT_FILTERS,
    });
    expect(settings.datePreset).toBeNull();
    expect(settings.days).toEqual({ from: "2026-10-05", to: "2026-10-05" });
  });
});
