import { app } from 'electron';
import { enableLinuxAutostart } from './linux-autostart';

/**
 * Every platform this app ships on ends up supported, but via two
 * different mechanisms — see `usesNativeLoginItem` and
 * `linux-autostart.ts`'s doc comment for why Linux can't just reuse
 * Electron's own API.
 */
export function supportsAutoLaunch(platform: NodeJS.Platform): boolean {
  return platform === 'win32' || platform === 'darwin' || platform === 'linux';
}

/** Electron's `setLoginItemSettings` only does anything on Windows and macOS. */
export function usesNativeLoginItem(platform: NodeJS.Platform): boolean {
  return platform === 'win32' || platform === 'darwin';
}

/**
 * Registers (or re-registers) this installed app to start at login,
 * Hubstaff/Time Doctor-style — an always-on monitoring agent that only
 * runs when the person remembers to launch it isn't much of one.
 *
 * Never runs in dev (`electron .`): `app.isPackaged` is false there, and
 * without that guard this would register Electron's own dev binary as a
 * login item, autostarting a whole dev shell on every login instead of the
 * real app.
 */
export function syncAutoLaunch(): void {
  if (!app.isPackaged) return;

  if (usesNativeLoginItem(process.platform)) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false });
    return;
  }

  if (process.platform === 'linux') {
    try {
      enableLinuxAutostart();
    } catch (error) {
      // Best-effort, same as activateBrowsersOnLinux in main.ts — losing
      // autostart must never stop the app itself from launching.
      console.error(`[auto-launch] failed to write Linux autostart entry: ${String(error)}`);
    }
  }
}
