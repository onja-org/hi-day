import { API_URL } from "./apiUrl";
import type { GetDevicePairingResult } from "@/types/devicePairing";

const INVALID_LINK_MESSAGE = "This link is invalid or has expired.";

export async function getDevicePairing(
  code: string,
): Promise<GetDevicePairingResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/device-pairing/${encodeURIComponent(code)}`,
      { credentials: "include" },
    );
  } catch {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  if (!response.ok) {
    return { ok: false, message: INVALID_LINK_MESSAGE };
  }

  const summary = await response.json();
  return { ok: true, summary };
}
