import type { DashboardWeekDay } from "@/types/dashboardSummary";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DisplayWeekDay = {
  label: string;
  seconds: number;
  isToday: boolean;
};

function weekdayOfKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Maps the backend's `thisWeekByDay` into display-ready rows. The week
 * starts on the organisation's chosen day, so each label comes from the
 * day's own date — read through UTC getters, since a bare "YYYY-MM-DD"
 * parsed with local ones can land on the wrong weekday near a timezone
 * boundary.
 */
export function buildWeekDays(
  thisWeekByDay: DashboardWeekDay[],
  now: Date = new Date(),
): DisplayWeekDay[] {
  const todayKey = localDateKey(now);
  return thisWeekByDay.map((day) => ({
    label: WEEKDAY_LABELS[weekdayOfKey(day.date)] ?? "",
    seconds: day.seconds,
    isToday: day.date === todayKey,
  }));
}
