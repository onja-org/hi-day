import { API_URL } from "./apiUrl";
import type { GetActiveMembersResult } from "@/types/membership";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * `scope: "visible"` (the default) is everyone the caller may see — an admin
 * the organisation, a team manager their team's members. `"organisation"` is
 * the Members page's own admin-only list.
 */
export async function getActiveMembers(
  organisationId: string,
  scope: "visible" | "organisation" = "visible",
): Promise<GetActiveMembersResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/memberships${
        scope === "visible" ? "/visible" : ""
      }`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const members = await response.json();
    return { ok: true, members };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
