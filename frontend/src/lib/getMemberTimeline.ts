import { API_URL } from "./apiUrl";
import type { GetMemberTimelineResult } from "@/types/insights";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetMemberTimelineFilter = {
  /** Omitted means the caller's own. */
  membershipId?: string;
  /** Inclusive `YYYY-MM-DD` days on the organisation's calendar. */
  from: string;
  to: string;
};

/** One member's Insights Timeline: a row per day of tracked, manual and idle time. */
export async function getMemberTimeline(
  organisationId: string,
  filter: GetMemberTimelineFilter,
): Promise<GetMemberTimelineResult> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.membershipId) params.set("membershipId", filter.membershipId);

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/insights/timeline?${params.toString()}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, message: "", timeline: await response.json() };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
