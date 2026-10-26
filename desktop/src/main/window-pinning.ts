/** The three window sizes; `mini` is the 68px square. */
export type WindowMode = 'full' | 'compact' | 'mini';

/**
 * Whether the window should float. The bar and the square are widgets,
 * no use behind an editor; the full window is the app, and floating it
 * would cover the work being tracked. One preference for both small
 * views, set from the tray — the only surface reachable from all three.
 */
export function shouldPin(mode: WindowMode, preference: boolean): boolean {
  if (mode === 'full') return false;
  return preference;
}

/**
 * The level to float at. Electron on Windows reads macOS's below-the-Dock
 * levels ("floating", its default, and the like) as "just behind the
 * taskbar", which leaves the window unpinned. "pop-up-menu" is the lowest
 * level that escapes that; macOS and Linux keep "floating".
 */
export function pinLevel(
  platform: NodeJS.Platform,
): 'floating' | 'pop-up-menu' {
  return platform === 'win32' ? 'pop-up-menu' : 'floating';
}
