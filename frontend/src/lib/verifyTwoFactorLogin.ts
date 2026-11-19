import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { TwoFactorLoginResult } from "@/types/twoFactor";

/**
 * The code step of logging in. The browser already holds the short-lived
 * challenge cookie the password step set; this sends the code with it.
 */
export async function verifyTwoFactorLogin(code: string): Promise<TwoFactorLoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login/two-factor`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
    captchaRequired?: boolean;
    restart?: boolean;
  } | null;
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "Logged in." };
  }

  return {
    ok: false,
    message: message ?? GENERIC_ERROR_MESSAGE,
    captchaRequired: data?.captchaRequired === true,
    restart: data?.restart === true,
  };
}
