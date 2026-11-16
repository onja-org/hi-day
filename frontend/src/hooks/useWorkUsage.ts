"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkUsage } from "@/lib/getWorkUsage";

export const WORK_USAGE_QUERY_KEY = (organisationId: string) => ["work-classification", organisationId];

/** The apps and sites the organisation used lately, with their labels. Admin-only. */
export function useWorkUsage(organisationId: string) {
  return useQuery({
    queryKey: WORK_USAGE_QUERY_KEY(organisationId),
    enabled: organisationId !== "",
    queryFn: async () => {
      const result = await getWorkUsage(organisationId);
      if (!result.ok) throw new Error(result.message);
      return result.items;
    },
  });
}
