"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";

/**
 * Whether this organisation tracks time against Projects. Read from the
 * cached organisation query, like `useOrganisationWeekStart`, because the
 * answer is needed in leaf components far from the page that fetched it.
 * Off while the query is pending: project UI appearing and then vanishing
 * is worse than it arriving a beat late.
 */
export function useProjectsEnabled(): boolean {
  return useCurrentOrganisation().data?.projectsEnabled ?? false;
}
