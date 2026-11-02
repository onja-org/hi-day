import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Electron's `app.setLoginItemSettings` is Windows/macOS only (see
 * auto-launch.ts) — Linux has no equivalent OS API, but every modern
 * desktop environment (GNOME, KDE, XFCE, Cinnamon, …) honors the
 * freedesktop **XDG Autostart** spec: a `.desktop` file dropped into
 * `~/.config/autostart/` gets launched automatically at login. This is the
 * same mechanism `applyBrowserActivation`
 * (resolvers/linux/browser-activation.ts) uses for the *applications*
 * directory, just a different one — per-user, no root required.
 */

/** Marks a file as ours, same convention as ACTIVATION_MARKER in browser-activation.ts — lets a later run (or an uninstall) tell its own output from something else. */
export const AUTOSTART_MARKER = '# Written by Hi Day to start at login.';

// Named after the app ID (electron-builder.yml's appId).
const AUTOSTART_FILE_NAME = 'io.hiday.app.desktop';

export function autostartDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(configHome, 'autostart');
}

export function autostartFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(autostartDirectory(env), AUTOSTART_FILE_NAME);
}

/**
 * An AppImage runs from a temp mountpoint that's different on every single
 * launch — `process.execPath` inside one points at that throwaway mount,
 * not at anything a `.desktop` file could `Exec=` next time. `$APPIMAGE`
 * (set by the AppImage runtime itself, before this process even starts) is
 * the one stable path back to the file a person actually double-clicked —
 * the same variable electron-updater's own Linux updater keys off of. A
 * `.deb` install (or `electron .` in dev) already runs from a fixed
 * location, so `process.execPath` there is already exactly what's wanted.
 */
export function resolveLinuxExecutablePath(
  env: NodeJS.ProcessEnv = process.env,
  execPath: string = process.execPath,
): string {
  return env.APPIMAGE ?? execPath;
}

/** The desktop-entry spec allows double-quoting an Exec value that contains whitespace. */
export function quoteExecPath(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

/**
 * `--no-sandbox` like every other entry that launches this app — the
 * scheme handler's, and both of electron-builder's. `chrome-sandbox` ships
 * mode 0755 rather than 4755, and a distribution that also restricts
 * unprivileged user namespaces (Ubuntu 24.04 and up) leaves the binary no
 * sandbox to enter, so it aborts before its first window. Omitting it here
 * is why this entry silently did nothing on a `.deb`: the app menu goes
 * through electron-builder's entry and works, a boot went through this one
 * and died, logging nothing.
 */
export function buildAutostartDesktopEntry(executablePath: string): string {
  return [
    AUTOSTART_MARKER,
    '[Desktop Entry]',
    'Type=Application',
    'Name=Hi Day',
    'Comment=Starts the Hi Day time-tracking agent at login.',
    `Exec=${quoteExecPath(executablePath)} --no-sandbox`,
    'X-GNOME-Autostart-enabled=true',
    'NoDisplay=false',
    'Terminal=false',
    '',
  ].join('\n');
}

/**
 * Idempotent — safe to call on every launch (and needs to be: an AppImage
 * that self-updated resolves to a new `$APPIMAGE` path each run, so a stale
 * entry from before an update would `Exec=` a file that no longer exists).
 */
export function enableLinuxAutostart(
  env: NodeJS.ProcessEnv = process.env,
  execPath: string = process.execPath,
): void {
  const directory = autostartDirectory(env);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    autostartFilePath(env),
    buildAutostartDesktopEntry(resolveLinuxExecutablePath(env, execPath)),
    'utf-8',
  );
}

/**
 * Removes only the entry this agent wrote (checked via the marker) —
 * mirrors removeBrowserActivation's own "never touch a file we didn't
 * write" rule. Not wired to an uninstall hook yet (neither is
 * removeBrowserActivation — see its own doc comment); available for when
 * one exists.
 */
export function disableLinuxAutostart(env: NodeJS.ProcessEnv = process.env): void {
  const path = autostartFilePath(env);
  if (!existsSync(path)) return;

  let contents: string;
  try {
    contents = readFileSync(path, 'utf-8');
  } catch {
    return;
  }
  if (!contents.includes(AUTOSTART_MARKER)) return;

  try {
    unlinkSync(path);
  } catch {
    // Best-effort — a stale entry pointing at a since-removed AppImage is
    // harmless (the DE just fails to launch it silently), never worth
    // throwing over.
  }
}
