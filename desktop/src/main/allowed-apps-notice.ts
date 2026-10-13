import type { AllowedApps } from "./api-client";

/**
 * What to tell the person at this agent when their organisation has
 * restricted tracking to another client. Null while the desktop agent is
 * allowed. Mirrors the web's `allowedAppsNotice`.
 */
export function allowedAppsNotice(allowed: AllowedApps): string | null {
  switch (allowed) {
    case "all":
    case "desktop_only":
      return null;
    case "mobile_only":
      return "Your organisation now tracks time from the mobile app. Your timer has been stopped and you can't start one here.";
  }
}
