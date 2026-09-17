import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * One script shape for the whole Chromium family — Chrome, Edge, Brave,
 * Vivaldi and Opera share an AppleScript dictionary — but the app name is
 * templated in as a LITERAL rather than passed as argv.
 *
 * AppleScript resolves an application's terminology at COMPILE time, and only
 * when the application is named literally. `tell application appName` with a
 * variable compiles against no dictionary at all, so `active tab` is not a
 * class and `tab` falls back to AppleScript's built-in tab character:
 *
 * `using terms from application "Google Chrome"` would also fix the compile,
 * but it requires Chrome to be INSTALLED to compile at all — which would break
 * a machine that has only Brave. Templating keeps each browser independent.
 *
 * appName comes from the registry's darwinAppName, never user input. It is
 * quoted defensively all the same.
 */
export function buildChromiumFamilyScript(appName: string): string {
  const literal = appName.replace(/["\\]/g, '\\$&');
  return `
on run argv
  tell application "System Events"
    if not (exists process "${literal}") then
      error "not-running"
    end if
    set isFrontmost to frontmost of process "${literal}"
  end tell
  if not isFrontmost then
    error "not-frontmost"
  end if
  tell application "${literal}"
    if (count of windows) = 0 then
      error "no-window"
    end if
    set w to front window
    set theURL to URL of active tab of w
    set theTitle to title of active tab of w
    set theMode to mode of w
  end tell
  return theURL & tab & theTitle & tab & theMode
end run
`.trimStart();
}

/**
 * Safari has its own dictionary and, critically, no `mode of window` (or
 * equivalent) — there is no private-mode signal on Safari at all. Callers
 * must map a missing third field to `private: null`, never `false`.
 */
export const SAFARI_SCRIPT = `
on run argv
  tell application "System Events"
    if not (exists process "Safari") then
      error "not-running"
    end if
    set isFrontmost to frontmost of process "Safari"
  end tell
  if not isFrontmost then
    error "not-frontmost"
  end if
  tell application "Safari"
    if (count of windows) = 0 then
      error "no-window"
    end if
    set w to front window
    set theURL to URL of current tab of w
    set theTitle to name of current tab of w
  end tell
  return theURL & tab & theTitle
end run
`;

/**
 * Onboarding's permission probe — deliberately NOT frontmost-gated, unlike
 * the resolve scripts above. Onboarding proactively checks installed
 * browsers regardless of which one (if any) currently has focus; it only
 * requires the target to already be running (never launches it). Sends the
 * simplest possible Apple Event (`get name`, present in every app's
 * standard suite) purely to surface the Automation consent prompt — the
 * actual response is never used for anything.
 */
export const PERMISSION_PROBE_SCRIPT = `
on run argv
  set appName to item 1 of argv
  tell application "System Events"
    if not (exists process appName) then
      error "not-running"
    end if
  end tell
  tell application appName
    get name
  end tell
  return "ok"
end run
`;

let scriptDir: string | null = null;
const materializedPaths = new Map<string, string>();

/**
 * Writes a script's source to a temp file once and reuses that path on
 * every subsequent call — avoids re-materializing on every osascript
 * invocation, and sidesteps the quoting/multi-line awkwardness of passing
 * an entire script via repeated `-e` flags.
 */
export function materializeScript(name: string, source: string): string {
  const existing = materializedPaths.get(name);
  if (existing) return existing;

  if (!scriptDir) {
    scriptDir = mkdtempSync(join(tmpdir(), 'darwin-resolver-scripts-'));
  }
  const path = join(scriptDir, `${name}.applescript`);
  writeFileSync(path, source, 'utf-8');
  materializedPaths.set(name, path);
  return path;
}
