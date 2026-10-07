import type { ReportFilters } from "@/lib/reportFilters";
import type { DateRange, DateRangePreset } from "./dateRange";
import type { ReportScope } from "./reportScope";
import type { TimeActivityGrouping } from "./timeActivityGrouping";

/** What a report page holds on screen, from which its saved settings are taken. */
export type SavedReportSettingsSource = {
  preset: DateRangePreset | null;
  range: DateRange;
  /** The zone the range's days are read in. */
  zone: string;
  scope: ReportScope;
  grouping: TimeActivityGrouping;
  filters: ReportFilters;
};
