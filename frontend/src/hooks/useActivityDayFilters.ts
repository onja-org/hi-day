"use client";

import { useSearchParams } from "next/navigation";
import { getDayRangeDateString } from "@/lib/getDayRange";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

/** The day/member/project filter state every Activity tab reads from the
 * same `?day=&membershipId=&projectId=` query string
 * (`ActivityFilterToolbar` writes it) — extracted so each tab's page
 * content doesn't re-derive it by hand. */
export function useActivityDayFilters() {
  const searchParams = useSearchParams();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";

  const dayOffset = Number(searchParams.get("day") ?? "0") || 0;
  const date = getDayRangeDateString(new Date(), dayOffset);
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  return { date, membershipId, projectId, canViewOthers };
}
