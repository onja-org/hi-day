import { useState } from "react";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { useViewerTimezone } from "@/hooks/useViewerTimezone";
import { getCustomDateRange } from "@/lib/getCustomDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { EMPTY_REPORT_FILTERS } from "@/lib/reportFilters";
import { timeActivityGroupings } from "@/lib/timeActivityReportConfig";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import type { ReportFilters } from "@/lib/reportFilters";
import { dateKeyInZone, detectTimezone } from "@/lib/timezone";
import type { DateRangePreset } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";
import type { SavedReportSettings } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";

export const DEFAULT_TIME_ACTIVITY_PRESET: DateRangePreset = "last_7_days";

/** The report's own controls — what the viewer has chosen, starting from a saved report's settings when one is opened. */
export function useTimeActivityReportControls(
  initial?: SavedReportSettings,
  organisationZone?: string | null,
) {
  const projectsEnabled = useProjectsEnabled();
  const [scope, setScope] = useState<ReportScope>(initial?.scope ?? "me");
  const [grouping, setGrouping] = useState<TimeActivityGrouping>(() =>
    // A saved report may hold a grouping that no longer exists (e.g. "todo").
    timeActivityGroupings(projectsEnabled).some((option) => option.value === initial?.grouping)
      ? initial!.grouping
      : "day",
  );
  const [preset, setPreset] = useState<DateRangePreset | null>(
    initial ? initial.datePreset : DEFAULT_TIME_ACTIVITY_PRESET,
  );
  const [filters, setFilters] = useState<ReportFilters>(initial?.filters ?? EMPTY_REPORT_FILTERS);
  // Days rather than instants, so a custom range means "these dates" in the viewer's zone.
  const [customDays, setCustomDays] = useState(() => {
    if (initial) return initial.days;
    const today = dateKeyInZone(new Date(), detectTimezone());
    return { from: today, to: today };
  });
  const viewerZone = useViewerTimezone();
  // The organisation's zone, as the report is the organisation's; the
  // viewer's only when it has none. UTC only before hydration, when no
  // entries are on screen yet.
  const zone = organisationZone ?? viewerZone ?? "UTC";
  const weekStart = useOrganisationWeekStart();
  const range = preset
    ? getTimesheetDateRange(preset, new Date(), zone, weekStart)
    : getCustomDateRange(customDays.from, customDays.to, zone);

  return {
    scope,
    setScope,
    grouping,
    setGrouping,
    preset,
    setPreset,
    filters,
    setFilters,
    setCustomDays,
    zone,
    range,
  };
}
