"use client";

import { useSearchParams } from "next/navigation";
import { activityDayKey } from "@/lib/activityDayKey";
import { useCanViewOthers } from "./useCanViewOthers";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

/** The day/member/project filter state every Activity tab reads from the
 * same `?day=&membershipId=&projectId=` query string
 * (`ActivityFilterToolbar` writes it) — extracted so each tab's page
 * content doesn't re-derive it by hand. `day` counts days back from today
 * on the organisation's calendar, the one the backend reads the day on. */
export function useActivityDayFilters() {
  const searchParams = useSearchParams();
  const canViewOthers = useCanViewOthers();
  const zone = useCurrentOrganisation().data?.timezone ?? "UTC";

  const now = new Date();
  const dayOffset = Number(searchParams.get("day") ?? "0") || 0;
  const todayKey = activityDayKey(now, zone);
  const date = activityDayKey(now, zone, dayOffset);
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  return { date, todayKey, membershipId, projectId, canViewOthers };
}
