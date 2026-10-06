import type { ReportFilters } from "@/lib/reportFilters";
import type { DateRangePreset } from "./dateRange";
import type { ReportSchedule } from "./reportSchedule";
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

/** A report saved to the user's account — see the backend's SavedReportView. */
export type SavedReportType = "time-and-activity" | "daily-totals" | "apps-and-urls";

export type SavedReport = {
  id: string;
  name: string;
  reportType: SavedReportType;
  settings: SavedReportSettings;
  /** When and to whom it is emailed; null when it isn't scheduled. */
  schedule: ReportSchedule | null;
  /** ISO instant of the last save. */
  modifiedAt: string;
  /** ISO instant of the last scheduled email that went out. */
  lastSentAt: string | null;
  /** Why the last scheduled email failed; null after a success. */
  lastError: string | null;
};

export type SaveReportInput = {
  /** Pass to update an existing saved report instead of adding a new one. */
  id?: string;
  /** Only read when adding; a saved report keeps its type. */
  reportType?: SavedReportType;
  name: string;
  settings: SavedReportSettings;
  schedule: ReportSchedule | null;
};

export type GetSavedReportsResult =
  | { ok: true; reports: SavedReport[] }
  | { ok: false; message: string };

export type SaveReportResult =
  | { ok: true; report: SavedReport }
  | { ok: false; message: string };

export type DeleteSavedReportResult =
  | { ok: true }
  | { ok: false; message: string };
