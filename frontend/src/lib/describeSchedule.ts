import { formatScheduleHour } from "@/lib/formatScheduleHour";
import { SCHEDULE_DAYS, SCHEDULE_FREQUENCIES } from "@/lib/scheduleOptions";
import type { ReportSchedule } from "@/types/reportSchedule";

/** "Weekly on Monday, Wednesday at 9:00 AM". */
export function describeSchedule(schedule: ReportSchedule): string {
  const frequency = SCHEDULE_FREQUENCIES.find((option) => option.value === schedule.frequency)?.label ?? "";
  const days = SCHEDULE_DAYS.filter((day) => schedule.days.includes(day.index))
    .map((day) => day.long)
    .join(", ");
  return `${frequency} on ${days} at ${formatScheduleHour(schedule.hour)}`;
}
