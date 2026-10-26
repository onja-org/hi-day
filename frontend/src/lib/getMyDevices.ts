import { API_URL } from "./apiUrl";
import type { GetDevicesResult } from "@/types/device";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** The signed-in user's own Devices, across every organisation. */
export async function getMyDevices(): Promise<GetDevicesResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/me/devices`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (!response.ok) {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const devices = await response.json();
  return { ok: true, devices };
}
