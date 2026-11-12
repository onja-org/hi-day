"use client";

import { useQuery } from "@tanstack/react-query";
import { getMemberTimeline } from "@/lib/getMemberTimeline";
import type { GetMemberTimelineFilter } from "@/lib/getMemberTimeline";

export const MEMBER_TIMELINE_QUERY_KEY = (
  organisationId: string,
  filter: GetMemberTimelineFilter,
) => [
  "insights",
  "timeline",
  organisationId,
  filter.membershipId ?? "self",
  filter.from,
  filter.to,
];

export function useMemberTimeline(
  organisationId: string,
  filter: GetMemberTimelineFilter,
) {
  return useQuery({
    queryKey: MEMBER_TIMELINE_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getMemberTimeline(organisationId, filter);
      if (!result.ok) throw new Error(result.message);
      return result.timeline;
    },
  });
}
