import { API_URL } from "./apiUrl";
import type {
  ResendVerificationInput,
  ResendVerificationResult,
} from "@/types/resendVerification";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

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

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "Verification email sent." };
  }

  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
