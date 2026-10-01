import { weekdayOfKey, zonedParts } from './zoned-time.util';

export interface ScheduleTiming {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  days: number[];
}

/**
 * Whether a scheduled report is due at `now`, read on the organisation's
 * wall clock in `zone`.
 *
 * It is due once per local day, from its delivery hour onward — not only
 * during that exact hour — so a scheduler that was down or ran late still
 * sends it the same day. `lastSentOn` (the local day of the previous send)
 * is what stops a second send.
 *
 * Daily and weekly both deliver on every chosen weekday (a "daily" report
 * simply has all seven chosen). Monthly delivers only on the first chosen
 * weekday of each month.
 */
export function isScheduleDue(
  schedule: ScheduleTiming,
  now: Date,
  zone: string,
  lastSentOn: string | null,
): boolean {
  const today = zonedParts(now, zone);
  if (lastSentOn === today.dateKey) return false;
  if (today.hour < schedule.hour) return false;
  if (!schedule.days.includes(today.weekday)) return false;
  if (schedule.frequency !== 'monthly') return true;

  for (let day = 1; day < today.day; day++) {
    const key = `${today.dateKey.slice(0, 8)}${String(day).padStart(2, '0')}`;
    if (schedule.days.includes(weekdayOfKey(key))) return false;
  }
  return true;
}
