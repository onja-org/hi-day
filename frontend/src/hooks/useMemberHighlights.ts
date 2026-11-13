"use client";

import { useQuery } from "@tanstack/react-query";
import { getMemberHighlights } from "@/lib/getMemberHighlights";
import type { GetMemberTimelineFilter } from "@/lib/getMemberTimeline";

export const MEMBER_HIGHLIGHTS_QUERY_KEY = (
  organisationId: string,
  filter: GetMemberTimelineFilter,
) => [
  "insights",
  "highlights",
  organisationId,
  filter.membershipId ?? "self",
  filter.from,
  filter.to,
];

export function useMemberHighlights(
  organisationId: string,
  filter: GetMemberTimelineFilter,
) {
  return useQuery({
    queryKey: MEMBER_HIGHLIGHTS_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getMemberHighlights(organisationId, filter);
      if (!result.ok) throw new Error(result.message);
      return result.report;
    },
  });
}
