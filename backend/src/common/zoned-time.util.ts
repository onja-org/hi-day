const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** The wall-clock date as YYYY-MM-DD. */
  dateKey: string;
}

/** What the wall clock in `zone` reads at `instant`. */
export function zonedParts(instant: Date, zone: string): ZonedParts {
  const read = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);
  const value = (type: string) =>
    read.find((part) => part.type === type)?.value ?? '';
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  return {
    year,
    month,
    day,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: WEEKDAYS.indexOf(value('weekday')),
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function offsetMs(instant: Date, zone: string): number {
  const p = zonedParts(instant, zone);
  const wallClockAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function keyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** The instant `dateKey` begins in `zone` (re-checked once so a daylight-saving change on that day is honoured). */
export function startOfDayInZone(dateKey: string, zone: string): Date {
  const guess = keyToUtcMs(dateKey);
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}

/** The last millisecond of `dateKey` in `zone`. */
export function endOfDayInZone(dateKey: string, zone: string): Date {
  return new Date(
    startOfDayInZone(addDaysToKey(dateKey, 1), zone).getTime() - 1,
  );
}

export function addDaysToKey(dateKey: string, days: number): string {
  return new Date(keyToUtcMs(dateKey) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (the zone doesn't matter). */
export function weekdayOfKey(dateKey: string): number {
  return new Date(keyToUtcMs(dateKey)).getUTCDay();
}

/** The Monday of the week `dateKey` falls in — weeks start on Monday, as in the app's date picker. */
export function mondayOfKey(dateKey: string): string {
  return addDaysToKey(dateKey, -((weekdayOfKey(dateKey) + 6) % 7));
}
