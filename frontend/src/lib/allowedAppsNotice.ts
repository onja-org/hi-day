import type { AllowedApps } from "@/types/organisation";

/**
 * What to tell someone on the web whose organisation has restricted time
 * tracking to another client. Null when the web timer is allowed.
 */
export function allowedAppsNotice(allowed: AllowedApps): string | null {
  switch (allowed) {
    case "all":
      return null;
    case "desktop_only":
      return "Your organisation tracks time from the desktop app. Open Hi Day on your computer to start a timer.";
    case "mobile_only":
      return "Your organisation tracks time from the mobile app. You can't start a timer here.";
  }
}
