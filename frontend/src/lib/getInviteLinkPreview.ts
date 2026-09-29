import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { GetInviteLinkPreviewResult } from "@/types/inviteLink";

export async function getInviteLinkPreview(token: string): Promise<GetInviteLinkPreviewResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/invite-links/${encodeURIComponent(token)}`, {
      method: "GET",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, preview: await response.json() };
  }

  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}
