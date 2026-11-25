import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApproveDevicePairingResult } from "@/types/devicePairing";

const INVALID_LINK_MESSAGE = "This link is invalid or has expired.";

export async function approveDevicePairing(
  code: string,
  organisationId?: string,
): Promise<ApproveDevicePairingResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/device-pairing/${encodeURIComponent(code)}/approve`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organisationId ? { organisationId } : {}),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  // 400 (no organisation chosen) and 403 (suspended, or not a member) have
  // something useful to say; everything else stays a deliberately vague
  // "invalid link".
  if (response.status === 400 || response.status === 403) {
    return { ok: false, message: await parseApiErrorMessage(response) };
  }
  if (!response.ok) {
    return { ok: false, message: INVALID_LINK_MESSAGE };
  }

  const body = await response.json();
  return { ok: true, ...body };
}
