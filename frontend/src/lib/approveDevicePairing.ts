import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { ApproveDevicePairingResult } from "@/types/devicePairing";

const INVALID_LINK_MESSAGE = "This link is invalid or has expired.";

export async function approveDevicePairing(
  code: string,
): Promise<ApproveDevicePairingResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/device-pairing/${encodeURIComponent(code)}/approve`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (!response.ok) {
    return { ok: false, message: INVALID_LINK_MESSAGE };
  }

  const body = await response.json();
  return { ok: true, ...body };
}
