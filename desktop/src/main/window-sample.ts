import type { DesktopDevicePlatform } from "./platform";

/**
 * Why a title came back unavailable — kept distinct rather than a single
 * boolean/"unknown" so the UI and any future reporting can tell "nothing
 * can be done" (Wayland) apart from "the person needs to grant access"
 * (macOS Accessibility) apart from "the app itself hides it" (incognito
 * windows, some password managers).
 */
export type TitleUnavailableReason =
  | "permission-denied"
  | "not-exposed"
  | "hidden-by-app";

export interface WindowSample {
  appName: string | null;
  title: string | null;
  titleUnavailableReason: TitleUnavailableReason | null;
  sampledAt: string;
}

export type WindowSampleSink = (sample: WindowSample) => void;

export interface TitleUnavailabilityInput {
  platform: DesktopDevicePlatform;
  /** Meaningless when platform !== 'macos'. */
  macAccessibilityGranted: boolean;
  /** Meaningless when platform !== 'linux'. */
  isWayland: boolean;
  rawTitle: string | undefined;
  rawOwnerName: string | undefined;
}

/**
 * Decision tree, in priority order:
 * 1. macOS + Accessibility not granted        -> 'permission-denied'
 *    (get-windows' own docs say `title` is actually gated by the Screen
 *    Recording permission, not Accessibility, on macOS — see
 *    docs/adr/0009-... This branch implements the ticket's stated model
 *    as a deliberate, flagged known gap pending real-hardware verification.)
 * 2. Linux + Wayland session                  -> 'not-exposed'
 *    (get-windows doesn't support Wayland at all; never even called there.)
 * 3. An owner/app name came back but no title -> 'hidden-by-app'
 * 4. Otherwise                                -> null (title is usable)
 */
export function classifyTitleUnavailability(
  input: TitleUnavailabilityInput,
): TitleUnavailableReason | null {
  if (input.platform === "macos" && !input.macAccessibilityGranted) {
    return "permission-denied";
  }
  if (input.platform === "linux" && input.isWayland) {
    return "not-exposed";
  }
  if (input.rawOwnerName && !input.rawTitle?.trim()) {
    return "hidden-by-app";
  }
  return null;
}
