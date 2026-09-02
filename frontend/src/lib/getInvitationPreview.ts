import { API_URL } from "./apiUrl";
import type { GetInvitationPreviewResult } from "@/types/invitation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getInvitationPreview(
  token: string,
): Promise<GetInvitationPreviewResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/invitations/${encodeURIComponent(token)}`,
      { method: "GET" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const preview = await response.json();
    return { ok: true, preview };
  }

  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}
