import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import { SCHEDULE_FREQUENCIES } from "@/lib/scheduleOptions";
import type { SavedReport } from "@/types/savedReport";

const PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_week",
  "last_2_weeks",
  "this_month",
  "last_month",
];

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReportSchedule(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const schedule = value as Record<string, unknown>;
  return (
    isStringList(schedule.emails) &&
    typeof schedule.message === "string" &&
    (schedule.fileType === "pdf" || schedule.fileType === "csv") &&
    typeof schedule.dateRange === "string" &&
    PRESETS.includes(schedule.dateRange) &&
    SCHEDULE_FREQUENCIES.some((option) => option.value === schedule.frequency) &&
    typeof schedule.hour === "number" &&
    Array.isArray(schedule.days) &&
    schedule.days.every((day) => typeof day === "number")
  );
}

/** Whether `value` has the full shape of a saved report — storage can hold anything, and the report page trusts these fields. */
function isSavedReport(value: unknown): value is SavedReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Record<string, unknown>;
  const settings = report.settings as Record<string, unknown> | undefined;
  const days = settings?.days as Record<string, unknown> | undefined;
  const filters = settings?.filters as Record<string, unknown> | undefined;
  return (
    typeof report.id === "string" &&
    typeof report.name === "string" &&
    report.reportType === "time-and-activity" &&
    typeof report.scheduled === "boolean" &&
    typeof report.modifiedAt === "string" &&
    (report.schedule === undefined || isReportSchedule(report.schedule)) &&
    settings !== undefined &&
    (settings.datePreset === null ||
      (typeof settings.datePreset === "string" && PRESETS.includes(settings.datePreset))) &&
    typeof days?.from === "string" &&
    typeof days?.to === "string" &&
    (settings.scope === "me" || settings.scope === "all") &&
    TIME_ACTIVITY_GROUPINGS.some((option) => option.value === settings.grouping) &&
    isStringList(filters?.memberIds) &&
    isStringList(filters?.teamIds) &&
    isStringList(filters?.projectIds)
  );
}

/** Reads the stored reports, dropping anything malformed; newest first. */
export function parseSavedReports(raw: string | null): SavedReport[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedReport)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch {
    return [];
  }
}

/** Replaces the report with the same id, or adds it when it's new. */
export function upsertSavedReport(reports: SavedReport[], report: SavedReport): SavedReport[] {
  return reports.some((existing) => existing.id === report.id)
    ? reports.map((existing) => (existing.id === report.id ? report : existing))
    : [...reports, report];
}

export function removeSavedReport(reports: SavedReport[], id: string): SavedReport[] {
  return reports.filter((report) => report.id !== id);
}
