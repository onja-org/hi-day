import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type {
  RecoveryCodesResult,
  TwoFactorChangeResult,
  TwoFactorSetup,
  TwoFactorSetupResult,
  TwoFactorStatus,
  TwoFactorStatusResult,
} from "@/types/twoFactor";

type Call<T> = { ok: true; data: T } | { ok: false; message: string };

/** The signed-in person's own two-step login (`/auth/two-factor`). */
async function call<T>(path: string, init: RequestInit): Promise<Call<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/two-factor${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string[] | string })
    | null;

  if (response.ok) return { ok: true, data: data as T };

  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatusResult> {
  const result = await call<TwoFactorStatus>("", { method: "GET" });
  return result.ok ? { ok: true, message: "", status: result.data } : result;
}

export async function startTwoFactorSetup(): Promise<TwoFactorSetupResult> {
  const result = await call<TwoFactorSetup>("/setup", { method: "POST" });
  return result.ok
    ? { ok: true, message: "Scan the QR code with your app.", setup: result.data }
    : result;
}

function postCode<T extends { message: string }>(path: string, code: string) {
  return call<T>(path, { method: "POST", body: JSON.stringify({ code }) });
}

export async function enableTwoFactor(code: string): Promise<RecoveryCodesResult> {
  const result = await postCode<{ recoveryCodes: string[]; message: string }>("/enable", code);
  return result.ok ? { ok: true, ...result.data } : result;
}

export async function disableTwoFactor(code: string): Promise<TwoFactorChangeResult> {
  const result = await postCode<{ message: string }>("/disable", code);
  return result.ok ? { ok: true, message: result.data.message } : result;
}

/** Every browser told "don't ask again", this one included, asks for a code next time. */
export async function forgetTrustedBrowsers(): Promise<TwoFactorChangeResult> {
  const result = await call<{ message: string }>("/trusted-browsers", { method: "DELETE" });
  return result.ok ? { ok: true, message: result.data.message } : result;
}

export async function renewRecoveryCodes(code: string): Promise<RecoveryCodesResult> {
  const result = await postCode<{ recoveryCodes: string[]; message: string }>(
    "/recovery-codes",
    code,
  );
  return result.ok ? { ok: true, ...result.data } : result;
}
