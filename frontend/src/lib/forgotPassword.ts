import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  ForgotPasswordInput,
  ForgotPasswordResult,
} from "@/types/forgotPassword";

export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<ForgotPasswordResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/password/forgot`, {
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
