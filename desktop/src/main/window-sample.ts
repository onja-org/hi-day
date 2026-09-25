import type { DesktopDevicePlatform } from "./platform";

/**
 * Why a title came back unavailable — kept distinct rather than a single
 * boolean/"unknown" so the UI and any future reporting can tell "nothing
 * can be done" (Wayland) apart from "the person needs to grant access"
 * (macOS Screen Recording) apart from "the app itself hides it" (incognito
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
  macScreenRecordingGranted: boolean;
  /** Meaningless when platform !== 'linux'. */
  isWayland: boolean;
  rawTitle: string | undefined;
  rawOwnerName: string | undefined;
}

/**
 * Decision tree, in priority order:
 * 1. macOS + Screen Recording not granted     -> 'permission-denied'
 *    (@paymoapp/active-window's own docs: the window `title` is only
 *    populated once Screen Recording access is granted — checked via
 *    `requestPermissions()` — this is the real macOS gate
 *    (`CGWindowListCopyWindowInfo` redacts titles without it), not
 *    Accessibility. See docs/adr/0011-... for the migration off
 *    `get-windows`, which had this modeled as Accessibility instead.)
 * 2. Linux, no window source at all           -> 'not-exposed'
 *    (XWayland clients come from X11 and are passed `isWayland: false`, an
 *    XWayland client being an X11 client. This is what remains: a
 *    Wayland-native window AT-SPI could not describe either.)
 * 3. An owner/app name came back but no title -> 'hidden-by-app'
 * 4. Otherwise                                -> null (title is usable)
 */
export function classifyTitleUnavailability(
  input: TitleUnavailabilityInput,
): TitleUnavailableReason | null {
  if (input.platform === "macos" && !input.macScreenRecordingGranted) {
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
