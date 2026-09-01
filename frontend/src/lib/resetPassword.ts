import { API_URL } from "./apiUrl";
import type {
  ResetPasswordInput,
  ResetPasswordResult,
} from "@/types/resetPassword";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

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

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "Password reset." };
  }

  return {
    ok: false,
    message: message ?? "This link is invalid or has expired.",
  };
}
