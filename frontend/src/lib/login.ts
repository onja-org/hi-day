import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { LoginInput, LoginResult } from "@/types/login";

const GENERIC_INVALID_LOGIN_MESSAGE = "Invalid email or password.";

export async function login(input: LoginInput): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  // The failure body carries `captchaRequired` alongside `message` (see
  // AuthService.login), so this reads both off one parsed body rather than
  // using the shared `parseApiErrorMessage` — that helper only returns a
  // message and would require a second, independent read of the same body.
  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
    captchaRequired?: boolean;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "Logged in." };
  }

  return {
    ok: false,
    message: message ?? GENERIC_INVALID_LOGIN_MESSAGE,
    captchaRequired: data?.captchaRequired === true,
  };
}
