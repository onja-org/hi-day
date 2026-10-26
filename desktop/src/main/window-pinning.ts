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
 * The level to float at. Electron bands these: `floating` — the default —
 * up to `status` sits below the taskbar on Windows and below the Dock on
 * macOS, and only `pop-up-menu` and above clear them. That band is why
 * `floating` failed to keep the window on top on Windows. macOS belongs
 * under its Dock, so it keeps `floating`, which is also what it already
 * used; Linux ignores the level entirely.
 */
export function pinLevel(
  platform: NodeJS.Platform,
): 'floating' | 'pop-up-menu' {
  return platform === 'win32' ? 'pop-up-menu' : 'floating';
}
