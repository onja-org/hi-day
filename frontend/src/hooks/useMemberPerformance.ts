"use client";

import { useQuery } from "@tanstack/react-query";
import { getMemberPerformance } from "@/lib/getMemberPerformance";
import type { GetMemberTimelineFilter } from "@/lib/getMemberTimeline";

export const MEMBER_PERFORMANCE_QUERY_KEY = (
  organisationId: string,
  filter: GetMemberTimelineFilter,
) => [
  "insights",
  "performance",
  organisationId,
  filter.membershipId ?? "self",
  filter.from,
  filter.to,
];

export function useMemberPerformance(
  organisationId: string,
  filter: GetMemberTimelineFilter,
) {
  return useQuery({
    queryKey: MEMBER_PERFORMANCE_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getMemberPerformance(organisationId, filter);
      if (!result.ok) throw new Error(result.message);
      return result.report;
    },
  });
}
