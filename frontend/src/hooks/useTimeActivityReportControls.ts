import { useState } from "react";
import { useViewerTimezone } from "@/hooks/useViewerTimezone";
import { getCustomDateRange } from "@/lib/getCustomDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { EMPTY_REPORT_FILTERS } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import { dateKeyInZone, detectTimezone } from "@/lib/timezone";
import type { DateRangePreset } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";
import type { SavedReportSettings } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";

export const DEFAULT_TIME_ACTIVITY_PRESET: DateRangePreset = "last_7_days";

/** The report's own controls — what the viewer has chosen, starting from a saved report's settings when one is opened. */
export function useTimeActivityReportControls(initial?: SavedReportSettings) {
  const [scope, setScope] = useState<ReportScope>(initial?.scope ?? "me");
  const [grouping, setGrouping] = useState<TimeActivityGrouping>(initial?.grouping ?? "day");
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
  // UTC only before hydration, when no entries are on screen yet.
  const zone = useViewerTimezone() ?? "UTC";
  const range = preset
    ? getTimesheetDateRange(preset, new Date(), zone)
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
