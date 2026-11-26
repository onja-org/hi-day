import type { WeekStart } from '../organisations/company-profile';
import type { SummaryPeriod } from '../organisations/summary-emails';
import {
  addDaysToKey,
  endOfDayInZone,
  startOfDayInZone,
  weekStartOfKey,
  zonedParts,
} from '../common/zoned-time.util';

/** Summaries go out from this hour on, in the Organisation's timezone —
 * early enough to read with the first coffee, late enough that yesterday's
 * overnight entries have been split at midnight. */
export const SUMMARY_SEND_HOUR = 7;

/** Calendar days, inclusive, YYYY-MM-DD in the Organisation's zone. */
export interface DayRange {
  fromKey: string;
  toKey: string;
}

export interface DueSummaryPeriod {
  period: SummaryPeriod;
  range: DayRange;
  /** The same length of time just before, for "vs. last week". */
  previous: DayRange;
}

/**
 * The summaries whose period has just ended, as of `now`: yesterday, every
 * day; and last week, on the first day of a new week. Nothing before
 * `SUMMARY_SEND_HOUR`. A server that was down at 07:00 still sends later
 * the same day — and only that day, so it never sends a stale summary.
 */
export function dueSummaryPeriods(
  now: Date,
  zone: string,
  weekStartsOn: WeekStart,
): DueSummaryPeriod[] {
  const { dateKey: today, hour } = zonedParts(now, zone);
  if (hour < SUMMARY_SEND_HOUR) return [];

  const yesterday = addDaysToKey(today, -1);
  const due: DueSummaryPeriod[] = [
    {
      period: 'daily',
      range: { fromKey: yesterday, toKey: yesterday },
      previous: {
        fromKey: addDaysToKey(today, -2),
        toKey: addDaysToKey(today, -2),
      },
    },
  ];

  if (weekStartOfKey(today, weekStartsOn) === today) {
    due.push({
      period: 'weekly',
      range: { fromKey: addDaysToKey(today, -7), toKey: yesterday },
      previous: {
        fromKey: addDaysToKey(today, -14),
        toKey: addDaysToKey(today, -8),
      },
    });
  }
  return due;
}

/** The instants a day range covers in `zone`, for querying entries. */
export function rangeInstants(
  range: DayRange,
  zone: string,
): { from: Date; to: Date } {
  return {
    from: startOfDayInZone(range.fromKey, zone),
    to: endOfDayInZone(range.toKey, zone),
  };
}

export function dayKeysOf(range: DayRange): string[] {
  const keys: string[] = [];
  for (
    let key = range.fromKey;
    key <= range.toKey;
    key = addDaysToKey(key, 1)
  ) {
    keys.push(key);
  }
  return keys;
}
