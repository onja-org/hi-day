import { API_URL } from "./apiUrl";
import type {
  ForgotPasswordInput,
  ForgotPasswordResult,
} from "@/types/forgotPassword";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

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

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return {
      ok: true,
      message:
        message ??
        "If that email has an account, we've sent a password reset link.",
    };
  }

  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
