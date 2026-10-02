import {
  addDaysToKey,
  endOfDayInZone,
  mondayOfKey,
  startOfDayInZone,
  zonedParts,
} from './zoned-time.util';

export const REPORT_DATE_PRESETS = [
  'today',
  'yesterday',
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

/**
 * The calendar days a preset covers, as of `now` in `zone` — the same
 * meanings the app's date picker gives them (weeks run Monday–Sunday;
 * "last week" and "last month" are whole periods before the current one).
 */
function presetDays(
  preset: ReportDatePreset,
  today: string,
): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = addDaysToKey(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case 'last_7_days':
      return { from: addDaysToKey(today, -6), to: today };
    case 'last_week': {
      const monday = mondayOfKey(addDaysToKey(today, -7));
      return { from: monday, to: addDaysToKey(monday, 6) };
    }
    case 'last_2_weeks':
      return {
        from: mondayOfKey(addDaysToKey(today, -14)),
        to: addDaysToKey(mondayOfKey(addDaysToKey(today, -7)), 6),
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
): { from: Date; to: Date } {
  const days = presetDays(preset, zonedParts(now, zone).dateKey);
  return {
    from: startOfDayInZone(days.from, zone),
    to: endOfDayInZone(days.to, zone),
  };
}
