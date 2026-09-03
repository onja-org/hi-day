import { API_URL } from "./apiUrl";
import type { GetMyProfileResult } from "@/types/profile";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getMyProfile(): Promise<GetMyProfileResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const profile = await response.json();
    return { ok: true, profile };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
