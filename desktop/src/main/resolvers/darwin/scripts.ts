import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * One parameterized script for the whole Chromium family — Chrome, Edge,
 * Brave, Vivaldi, Opera all share this AppleScript dictionary (see
 * docs/url-tracking-plan.md Step 8). `appName` (argv[1]) is the process/app
 * name from the browser registry's `darwinAppName`, never a bundle id.
 *
 * The `not-running`/`not-frontmost`/`no-window` checks run entirely inside
 * System Events, before ever sending `tell application appName` — that's
 * what guarantees this never launches the browser: `tell application X`
 * only auto-launches when X isn't already a running process, and we've
 * already confirmed it is one by this point.
 */
export const CHROMIUM_FAMILY_SCRIPT = `
on run argv
  set appName to item 1 of argv
  tell application "System Events"
    if not (exists process appName) then
      error "not-running"
    end if
    set isFrontmost to frontmost of process appName
  end tell
  if not isFrontmost then
    error "not-frontmost"
  end if
  tell application appName
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
`;

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
