import type { WeekStart } from '../organisations/company-profile';
import {
  addDaysToKey,
  startOfDayInZone,
  weekStartOfKey,
  zonedParts,
} from './zoned-time.util';

/** "This week" and its neighbours on an organisation's own calendar. */
export interface CalendarWeek {
  /** Today's date in the zone, YYYY-MM-DD. */
  todayKey: string;
  /** The seven dates of this week, from its first day. */
  dayKeys: string[];
  todayStart: Date;
  yesterdayStart: Date;
  weekStart: Date;
  /** Exclusive: the instant next week begins. */
  weekEnd: Date;
  lastWeekStart: Date;
}

/**
 * The week `now` falls in, worked out on `zone`'s calendar rather than the
 * server's, so a day starts at the organisation's own midnight. Days are
 * stepped as calendar dates, never 24-hour blocks, so a daylight-saving
 * change inside the week can't shift a boundary by an hour.
 */
export function calendarWeekAt(
  now: Date,
  zone: string,
  weekStartsOn: WeekStart,
): CalendarWeek {
  const todayKey = zonedParts(now, zone).dateKey;
  const weekStartKey = weekStartOfKey(todayKey, weekStartsOn);
  return {
    todayKey,
    dayKeys: Array.from({ length: 7 }, (_, index) =>
      addDaysToKey(weekStartKey, index),
    ),
    todayStart: startOfDayInZone(todayKey, zone),
    yesterdayStart: startOfDayInZone(addDaysToKey(todayKey, -1), zone),
    weekStart: startOfDayInZone(weekStartKey, zone),
    weekEnd: startOfDayInZone(addDaysToKey(weekStartKey, 7), zone),
    lastWeekStart: startOfDayInZone(addDaysToKey(weekStartKey, -7), zone),
  };
}

/** The calendar date `instant` falls on in `zone`, YYYY-MM-DD. */
export function dateKeyInZone(instant: Date, zone: string): string {
  return zonedParts(instant, zone).dateKey;
}
