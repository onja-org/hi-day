"use client";

import { useQuery } from "@tanstack/react-query";
import { getMemberUnusualActivity } from "@/lib/getMemberUnusualActivity";
import type { GetMemberTimelineFilter } from "@/lib/getMemberTimeline";

export const MEMBER_UNUSUAL_ACTIVITY_QUERY_KEY = (
  organisationId: string,
  filter: GetMemberTimelineFilter,
) => [
  "insights",
  "unusual-activity",
  organisationId,
  filter.membershipId ?? "self",
  filter.from,
  filter.to,
];

export function useMemberUnusualActivity(
  organisationId: string,
  filter: GetMemberTimelineFilter,
) {
  return useQuery({
    queryKey: MEMBER_UNUSUAL_ACTIVITY_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getMemberUnusualActivity(organisationId, filter);
      if (!result.ok) throw new Error(result.message);
      return result.report;
    },
  });
}
