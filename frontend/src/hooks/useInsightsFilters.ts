"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useOrganisationWeekStart } from "@/hooks/useOrganisationWeekStart";
import { getCustomDateRange } from "@/lib/getCustomDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { parseInsightsRange } from "@/lib/parseInsightsRange";
import { dateKeyInZone } from "@/lib/timezone";
import type { DateRange, DateRangePreset } from "@/types/dateRange";

/**
 * The member and date range every Insights page reads from the same
 * `?member=&preset=` / `?member=&from=&to=` query string, so switching
 * between Insights pages keeps both. No `member` means the viewer's own.
 * Days are read on the organisation's calendar, like the backend.
 */
export function useInsightsFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const zone = useCurrentOrganisation().data?.timezone ?? "UTC";
  const weekStart = useOrganisationWeekStart();

  const membershipId = searchParams.get("member") ?? undefined;
  const choice = parseInsightsRange({
    preset: searchParams.get("preset"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  const range: DateRange = choice.preset
    ? getTimesheetDateRange(choice.preset, new Date(), zone, weekStart)
    : getCustomDateRange(choice.days.from, choice.days.to, zone);

  const setRange = (next: DateRange, preset: DateRangePreset | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("preset");
    params.delete("from");
    params.delete("to");
    if (preset) {
      params.set("preset", preset);
    } else {
      params.set("from", dateKeyInZone(next.from, zone));
      params.set("to", dateKeyInZone(next.to, zone));
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return {
    membershipId,
    preset: choice.preset,
    range,
    fromKey: dateKeyInZone(range.from, zone),
    toKey: dateKeyInZone(range.to, zone),
    zone,
    setRange,
  };
}
