import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

export type TimeOfDayOption = {
  /** `HH:mm`, the wall-clock time this option sets. */
  value: string;
  /** Later than now on today's date, so it cannot be chosen. */
  disabled: boolean;
};

type TimeOfDayArgs = {
  /** `YYYY-MM-DD` these times belong to — only today has a cut-off. */
  date: string;
  now?: Date;
  stepMinutes?: number;
  /** A time to keep listed even when it is off-step, so an entry recorded
   * at 09:37 stays editable. */
  include?: string;
};

const MINUTES_IN_DAY = 24 * 60;

function label(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < MINUTES_IN_DAY ? minutes : null;
}

/** The times a picker may offer for one date, and which have not happened. */
export function timeOfDayOptions({
  date,
  now = new Date(),
  stepMinutes = 5,
  include,
}: TimeOfDayArgs): TimeOfDayOption[] {
  const local = toDatetimeLocalValue(now.toISOString());
  const isToday = date === local.slice(0, 10);
  const cutoff = toMinutes(local.slice(11, 16)) ?? MINUTES_IN_DAY;

  const minutes = new Set<number>();
  for (let minute = 0; minute < MINUTES_IN_DAY; minute += stepMinutes) {
    minutes.add(minute);
  }
  const extra = include ? toMinutes(include) : null;
  if (extra !== null) minutes.add(extra);

  return [...minutes]
    .sort((a, b) => a - b)
    .map((minute) => ({
      value: label(minute),
      // The entry's own time stays choosable, or it could not re-save itself.
      disabled: isToday && minute > cutoff && minute !== extra,
    }));
}
