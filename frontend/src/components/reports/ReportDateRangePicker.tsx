"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { DEFAULT_TIME_ACTIVITY_PRESET } from "@/hooks/useTimeActivityReportControls";
import { dateKeyInZone } from "@/lib/timezone";
import type { DateRange, DateRangePreset } from "@/types/dateRange";

type ReportDateRangePickerProps = {
  id: string;
  range: DateRange;
  /** null when `range` is a custom calendar selection. */
  preset: DateRangePreset | null;
  zone: string;
  setCustomDays: (days: { from: string; to: string }) => void;
  setPreset: (preset: DateRangePreset | null) => void;
};

/** The "Date range" picker wired to a report's controls: a pick sets both the preset and the custom days, read in the report's zone. */
export function ReportDateRangePicker({ id, range, preset, zone, setCustomDays, setPreset }: ReportDateRangePickerProps) {
  return (
    <DateRangePicker
      id={id}
      label="Date range"
      value={range}
      preset={preset}
      defaultPreset={DEFAULT_TIME_ACTIVITY_PRESET}
      zone={zone}
      onChange={(next, nextPreset) => {
        setCustomDays({ from: dateKeyInZone(next.from, zone), to: dateKeyInZone(next.to, zone) });
        setPreset(nextPreset);
      }}
    />
  );
}
