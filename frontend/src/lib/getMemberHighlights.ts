import { API_URL } from "./apiUrl";
import type { GetMemberTimelineFilter } from "./getMemberTimeline";
import type { GetMemberHighlightsResult } from "@/types/highlights";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** What stood out for one member over a range: unusual activity and big changes in behaviour. */
export async function getMemberHighlights(
  organisationId: string,
  filter: GetMemberTimelineFilter,
): Promise<GetMemberHighlightsResult> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.membershipId) params.set("membershipId", filter.membershipId);

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/insights/highlights?${params.toString()}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, message: "", report: await response.json() };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
