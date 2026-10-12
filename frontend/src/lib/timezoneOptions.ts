import { describeTimezone, timezoneLabel } from "@/lib/timezone";

export type TimezoneOptionGroup = {
  region: string;
  zones: { value: string; label: string }[];
};

/** Throws for a zone the runtime doesn't know; the plain spelling will do. */
function labelFor(zone: string): string {
  try {
    return describeTimezone(zone);
  } catch {
    return timezoneLabel(zone);
  }
}

/**
 * Every IANA zone the runtime knows, grouped by region for a `<select>`.
 * `extra` forces a stored zone into the list even when the runtime omits it
 * — including UTC, which `supportedValuesOf` leaves out despite it being
 * every organisation's default. Without it the picker would open on some
 * other zone and save that one instead.
 */
export function timezoneOptions(extra?: string | null): TimezoneOptionGroup[] {
  const supported = Intl.supportedValuesOf?.("timeZone") ?? [];
  const zones = [...new Set(["UTC", ...supported, ...(extra ? [extra] : [])])].sort();

  const byRegion = new Map<string, { value: string; label: string }[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.split("/")[0] : "Other";
    const group = byRegion.get(region) ?? [];
    group.push({ value: zone, label: labelFor(zone) });
    byRegion.set(region, group);
  }

  return [...byRegion.entries()]
    .map(([region, groupedZones]) => ({ region, zones: groupedZones }))
    .sort((a, b) => a.region.localeCompare(b.region));
}
