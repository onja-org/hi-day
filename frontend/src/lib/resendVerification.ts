import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type {
  ResendVerificationInput,
  ResendVerificationResult,
} from "@/types/resendVerification";

export async function resendVerification(
  input: ResendVerificationInput,
): Promise<ResendVerificationResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/resend-verification`, {
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
