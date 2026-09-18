import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { UpdateMyProfileInput, UpdateMyProfileResult } from "@/types/profile";

export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<UpdateMyProfileResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, ...body };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
