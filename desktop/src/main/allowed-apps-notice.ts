import type { AllowedApps } from "./api-client";

/** Null while this agent may track. Mirrors the web's `allowedAppsNotice`. */
export function allowedAppsNotice(allowed: AllowedApps): string | null {
  // Only `mobile_only` leaves this agent with nothing to track. Anything
  // else — including a value an older server didn't send — is permissive,
  // so a missing field can never lock someone out of their own timer.
  return allowed === "mobile_only"
    ? "Your organisation now tracks time from the mobile app. Your timer has been stopped and you can't start one here."
    : null;
}
