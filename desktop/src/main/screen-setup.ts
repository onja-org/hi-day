import { screen } from 'electron';

export interface ScreenDescription {
  internal: boolean;
  label: string;
  size: { width: number; height: number };
}

/**
 * Names the set of screens connected right now — "the laptop alone",
 * "the laptop and a monitor", "a monitor with the lid closed" — so a
 * remembered ScreenCast choice is only ever tried in the setup it was made
 * in (wayland-silent-capture.ts).
 *
 * GNOME remembers a choice as one particular screen. Tried while that
 * screen is gone, it shows the picker and then forgets the choice for good,
 * even once the screen is back. So the key has to tell apart setups that
 * look alike by size: closing the lid on a 1920×1080 monitor leaves one
 * 1920×1080 screen, just as the laptop alone does.
 *
 * Names do that: the laptop's screen is reported as "Built-in display", and
 * under XWayland an external monitor has no name at all. `internal` is not
 * used — under XWayland it is not reliable: with the lid closed on a
 * monitor, the same monitor came back flagged internal one time and
 * external the next, which named one setup two ways and lost its choice.
 * Two unnamed monitors of the same size share a key, so the second one is
 * granted after the first one's choice is rejected.
 */
export function screenSetupKey(displays: ScreenDescription[]): string {
  if (displays.length === 0) return 'no-screens';
  return displays
    .map(
      (display) =>
        `${display.label || 'unnamed'}:${display.size.width}x${display.size.height}`,
    )
    .sort()
    .join('+');
}

/** The key for the screens Electron reports now. */
export function currentScreenSetupKey(): string {
  return screenSetupKey(screen.getAllDisplays());
}
