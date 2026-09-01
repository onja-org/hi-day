import { API_URL } from "./apiUrl";
import type { LoginInput, LoginResult } from "@/types/login";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
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

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;

  if (response.ok) {
    return { ok: true, message: message ?? "Logged in." };
  }

  return { ok: false, message: message ?? GENERIC_INVALID_LOGIN_MESSAGE };
}
