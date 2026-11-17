import { BadRequestException } from '@nestjs/common';
import { dateKeyInZone } from './calendar-week.util';
import { addDaysToKey, startOfDayInZone } from './zoned-time.util';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** One day of the Activities section, on the organisation's calendar. */
export interface ActivityDay {
  /** The day, YYYY-MM-DD. */
  date: string;
  /** The organisation's midnight that begins it. */
  start: Date;
  /** Exclusive: the next day's midnight. */
  end: Date;
}

/**
 * The day an Activities read (Apps, URLs, Screenshots, Notes) covers: the
 * caller's `?date=`, or today, both read on `zone`'s calendar — the same
 * days Timesheets, Insights and the dashboards group by. The end is the
 * next day's midnight rather than start + 24 hours, because a day the
 * clocks change on is 23 or 25 hours long.
 */
export function activityDayIn(
  date: string | undefined,
  zone: string,
  now: Date = new Date(),
): ActivityDay {
  if (date !== undefined && !DATE_PATTERN.test(date)) {
    throw new BadRequestException('date must be formatted as YYYY-MM-DD.');
  }
  const key = date ?? dateKeyInZone(now, zone);
  return {
    date: key,
    start: startOfDayInZone(key, zone),
    end: startOfDayInZone(addDaysToKey(key, 1), zone),
  };
}
