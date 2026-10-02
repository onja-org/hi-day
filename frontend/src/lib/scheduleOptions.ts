import type { ScheduleFrequency } from "@/types/reportSchedule";

export const SCHEDULE_FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Sunday first, matching the day buttons' order. */
export const SCHEDULE_DAYS: { index: number; short: string; long: string }[] = [
  { index: 0, short: "Su", long: "Sunday" },
  { index: 1, short: "Mo", long: "Monday" },
  { index: 2, short: "Tu", long: "Tuesday" },
  { index: 3, short: "We", long: "Wednesday" },
  { index: 4, short: "Th", long: "Thursday" },
  { index: 5, short: "Fr", long: "Friday" },
  { index: 6, short: "Sa", long: "Saturday" },
];
