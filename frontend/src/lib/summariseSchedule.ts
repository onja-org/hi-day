import { SCHEDULE_DAYS, SCHEDULE_FREQUENCIES } from "@/lib/scheduleOptions";
import type { ReportSchedule } from "@/types/reportSchedule";

/** "Daily | Mon, Tue, Wed | PDF" — the short form for a table cell. */
export function summariseSchedule(schedule: ReportSchedule): string {
  const frequency = SCHEDULE_FREQUENCIES.find((option) => option.value === schedule.frequency)?.label ?? "";
  const days = SCHEDULE_DAYS.filter((day) => schedule.days.includes(day.index))
    .map((day) => day.long.slice(0, 3))
    .join(", ");
  return `${frequency} | ${days} | ${schedule.fileType.toUpperCase()}`;
}
