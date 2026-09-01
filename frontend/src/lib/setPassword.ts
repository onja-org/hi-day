import { API_URL } from "./apiUrl";
import type { SetPasswordInput, SetPasswordResult } from "@/types/setPassword";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function setPassword(
  input: SetPasswordInput,
): Promise<SetPasswordResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/set-password`, {
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

  if (response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message[0]
      : data?.message;
    return { ok: true, message: message ?? "Password set." };
  }

  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return {
    ok: false,
    message: message ?? "This link is invalid or has expired.",
  };
}
