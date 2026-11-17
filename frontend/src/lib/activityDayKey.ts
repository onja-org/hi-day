import { addDaysToKey, dateKeyInZone } from "@/lib/timezone";

/**
 * The `YYYY-MM-DD` day the Activities pages (Apps, URLs, Screenshots,
 * Notes) show, `offset` days from today on the organisation's calendar —
 * the same day the backend reads, so the label and the data agree for
 * every viewer, whatever their own clock says.
 */
export function activityDayKey(now: Date, zone: string, offset = 0): string {
  return addDaysToKey(dateKeyInZone(now, zone), offset);
}
