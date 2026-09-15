import type { DashboardWeekDay } from "@/types/dashboardSummary";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DisplayWeekDay = {
  label: string;
  seconds: number;
  isToday: boolean;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Maps the backend's Sunday-Saturday `thisWeekByDay` into display-ready
 * rows. Weekday labels come from array position (the backend guarantees
 * Sunday-first order), not by parsing `date` — a bare "YYYY-MM-DD" string
 * parses as UTC midnight, which can land on the wrong local weekday near a
 * timezone boundary.
 */
export function buildWeekDays(
  thisWeekByDay: DashboardWeekDay[],
  now: Date = new Date(),
): DisplayWeekDay[] {
  const todayKey = localDateKey(now);
  return thisWeekByDay.map((day, index) => ({
    label: WEEKDAY_LABELS[index] ?? "",
    seconds: day.seconds,
    isToday: day.date === todayKey,
  }));
}
