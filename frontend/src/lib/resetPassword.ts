import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  ResetPasswordInput,
  ResetPasswordResult,
} from "@/types/resetPassword";

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<ResetPasswordResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/password/reset`, {
      method: "POST",
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
