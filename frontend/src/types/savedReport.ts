import type { ReportFilters } from "@/lib/reportFilters";
import type { DateRangePreset } from "./dateRange";
import type { ReportScope } from "./reportScope";
import type { TimeActivityGrouping } from "./timeActivityGrouping";

/** Everything the Time and activity report restores when a saved report is opened. */
export type SavedReportSettings = {
  /** A rolling preset like "last 7 days" stays rolling when reopened; null means `days` is a fixed custom range. */
  datePreset: DateRangePreset | null;
  /** Date keys ("2026-09-28") in the viewer's zone — the custom range, or what the preset resolved to when saved. */
  days: { from: string; to: string };
  scope: ReportScope;
  grouping: TimeActivityGrouping;
  filters: ReportFilters;
};

export type SavedReport = {
  id: string;
  name: string;
  reportType: "time-and-activity";
  settings: SavedReportSettings;
  /** The "schedule report to be sent" choice from the save modal. Email delivery itself isn't built yet. */
  scheduled: boolean;
  /** ISO instant of the last save. */
  modifiedAt: string;
};
