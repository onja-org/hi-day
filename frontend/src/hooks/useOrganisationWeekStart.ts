"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { WeekStart } from "@/types/organisation";

/**
 * Read from the cached organisation query rather than passed down: a week
 * boundary is needed in leaf components several levels apart. Falls back to
 * Monday, as the date helpers do, while the query is pending.
 */
export function useOrganisationWeekStart(): WeekStart {
  return useCurrentOrganisation().data?.weekStartsOn ?? "monday";
}
