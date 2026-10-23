import type { WeekStart } from '../organisations/company-profile';
import {
  addDaysToKey,
  endOfDayInZone,
  mondayOfKey,
  startOfDayInZone,
  weekdayOfKey,
  zonedParts,
} from './zoned-time.util';

export const REPORT_DATE_PRESETS = [
  'today',
  'yesterday',
  'this_week',
  'last_7_days',
  'last_week',
  'last_2_weeks',
  'this_month',
  'last_month',
] as const;

export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[number];

function firstOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 8)}01`;
}

/** The first day of the week `dateKey` falls in. */
function weekStartOfKey(dateKey: string, weekStartsOn: WeekStart): string {
  return weekStartsOn === 'sunday'
    ? addDaysToKey(dateKey, -weekdayOfKey(dateKey))
    : mondayOfKey(dateKey);
}

/**
 * The calendar days a preset covers, as of `now` in `zone` — the same
 * meanings the app's date picker gives them (weeks start on the
 * organisation's chosen day; "last week" and "last month" are whole periods
 * before the current one).
 */
function presetDays(
  preset: ReportDatePreset,
  today: string,
  weekStartsOn: WeekStart,
): { from: string; to: string } {
  const weekStart = (key: string) => weekStartOfKey(key, weekStartsOn);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = addDaysToKey(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case 'this_week': {
      // The whole week, days still to come included — they just have
      // nothing in them yet.
      const first = weekStart(today);
      return { from: first, to: addDaysToKey(first, 6) };
    }
    case 'last_7_days':
      return { from: addDaysToKey(today, -6), to: today };
    case 'last_week': {
      const first = weekStart(addDaysToKey(today, -7));
      return { from: first, to: addDaysToKey(first, 6) };
    }
    case 'last_2_weeks':
      return {
        from: weekStart(addDaysToKey(today, -14)),
        to: addDaysToKey(weekStart(addDaysToKey(today, -7)), 6),
      };
    case 'this_month':
      return { from: firstOfMonth(today), to: today };
    case 'last_month': {
      const lastOfPrevious = addDaysToKey(firstOfMonth(today), -1);
      return { from: firstOfMonth(lastOfPrevious), to: lastOfPrevious };
    }
  }
}

/** The inclusive instant range a preset covers, as of `now` in `zone`. */
export function resolveReportDateRange(
  preset: ReportDatePreset,
  now: Date,
  zone: string,
  weekStartsOn: WeekStart = 'monday',
): { from: Date; to: Date } {
  const days = presetDays(preset, zonedParts(now, zone).dateKey, weekStartsOn);
  return {
    from: startOfDayInZone(days.from, zone),
    to: endOfDayInZone(days.to, zone),
  };
}
