import { API_URL } from "./apiUrl";
import type { SignOutDeviceResult } from "@/types/device";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function signOutDevice(
  organisationId: string,
  deviceId: string,
): Promise<SignOutDeviceResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/devices/${deviceId}/sign-out`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const device = await response.json();
    return { ok: true, device };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
