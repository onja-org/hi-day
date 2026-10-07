import type { ReportSchedule } from "@/types/reportSchedule";

type ScheduleTiming = Pick<ReportSchedule, "frequency" | "hour" | "days">;

/** How far `zone`'s wall clock is ahead of UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant at which `zone`'s wall clock reads the given date and hour. */
function zonedInstant(year: number, month: number, day: number, hour: number, zone: string): number {
  const guess = Date.UTC(year, month, day, hour);
  const first = guess - zoneOffsetMs(guess, zone);
  // Re-read the offset at the result so a daylight-saving change in between is honoured.
  return guess - zoneOffsetMs(first, zone);
}

/**
 * When a schedule next delivers after `now`, read on the organisation's wall
 * clock in `zone`; null when it has no delivery days. Mirrors the backend's
 * `isScheduleDue`: daily and weekly deliver on every chosen weekday, monthly
 * only on the first chosen weekday of each month.
 */
export function nextScheduledRun(schedule: ScheduleTiming, now: Date, zone: string): Date | null {
  if (schedule.days.length === 0) return null;

  const today = new Date(now.getTime() + zoneOffsetMs(now.getTime(), zone));
  for (let offset = 0; offset <= 62; offset++) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    if (!schedule.days.includes(date.getUTCDay())) continue;
    if (schedule.frequency === "monthly") {
      const earlier = Array.from({ length: date.getUTCDate() - 1 }, (_, index) =>
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), index + 1)).getUTCDay(),
      );
      if (earlier.some((weekday) => schedule.days.includes(weekday))) continue;
    }
    const instant = zonedInstant(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), schedule.hour, zone);
    if (instant > now.getTime()) return new Date(instant);
  }
  return null;
}
