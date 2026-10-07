import { dateKeyInZone } from "@/lib/timezone";
import type { SavedReportSettings } from "@/types/savedReport";
import type { SavedReportSettingsSource } from "@/types/savedReportSettingsSource";

/** The settings a saved report restores: the date range as day keys in the report's zone, plus the page's choices. */
export function buildSavedReportSettings({
  preset,
  range,
  zone,
  scope,
  grouping,
  filters,
}: SavedReportSettingsSource): SavedReportSettings {
  return {
    datePreset: preset,
    days: { from: dateKeyInZone(range.from, zone), to: dateKeyInZone(range.to, zone) },
    scope,
    grouping,
    filters,
  };
}
