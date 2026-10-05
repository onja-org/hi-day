import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Restarting a blind browser so it comes back with an accessibility tree.
 *
 * Destructive by nature — whatever is unsaved dies with the process, and no
 * flag restores that — so it never runs on its own, only on the button, and
 * only against browsers that are actually blind.
 *
 * Tabs are recoverable, conditionally. Chromium takes
 * `--restore-last-session`, which reopens the session whatever the person's
 * startup preference. Firefox has no such flag: it restores only when
 * `browser.startup.page` is 3, so one without that preference is left
 * running and reported for the person to restart themselves.
 */
export const CHROMIUM_RESTORE_FLAG = '--restore-last-session';

/** The Gecko preference that makes Firefox reopen last time's windows. */
const FIREFOX_RESTORE_PREF = 'browser.startup.page';
const FIREFOX_RESTORE_SESSION = 3;

export interface RestartCandidate {
  pid: number;
  command: string;
  desktopFileName: string;
}

export interface RestartOutcome {
  pid: number;
  command: string;
  restarted: boolean;
  /** Why it was left running, when it was. */
  reason?: string;
}

/** Firefox and its forks ignore the Chromium flag, and vice versa. */
export function isGeckoBrowser(command: string): boolean {
  return /firefox|librewolf|waterfox|zen/i.test(command);
}

/**
 * Whether Firefox would reopen its tabs after a restart. Pessimistic: an
 * unreadable profile or a missing preference answers "no", because being
 * wrong that way costs a manual restart and the other way costs their tabs.
 */
export function firefoxRestoresSession(prefsContents: string[]): boolean {
  // Later files win, matching Firefox: user.js is applied over prefs.js.
  let restores = false;
  for (const contents of prefsContents) {
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(
        /user_pref\(\s*["']browser\.startup\.page["']\s*,\s*(\d+)\s*\)/,
      );
      if (match) restores = Number(match[1]) === FIREFOX_RESTORE_SESSION;
    }
  }
  return restores;
}

/** Every `prefs.js` and `user.js` under the Firefox profile directory. */
export function readFirefoxPrefs(home = homedir()): string[] {
  const roots = [
    join(home, '.mozilla', 'firefox'),
    join(home, 'snap', 'firefox', 'common', '.mozilla', 'firefox'),
    join(home, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox'),
  ];

  const contents: string[] = [];
  for (const root of roots) {
    let profiles: string[];
    try {
      profiles = readdirSync(root);
    } catch {
      continue;
    }
    for (const profile of profiles) {
      for (const file of ['prefs.js', 'user.js']) {
        try {
          contents.push(readFileSync(join(root, profile, file), 'utf-8'));
        } catch {
          // A profile without one of these is ordinary.
        }
      }
    }
  }
  return contents;
}

/** Whether this browser can be restarted without costing someone their
 * tabs. The reason names the preference, so the banner can say which one. */
export function canRestartSafely(
  command: string,
  firefoxRestores: boolean,
): { safe: boolean; reason?: string } {
  if (!isGeckoBrowser(command)) return { safe: true };
  if (firefoxRestores) return { safe: true };
  return {
    safe: false,
    reason: `Firefox would not reopen its tabs — turn on "Show my windows and tabs from last time" (${FIREFOX_RESTORE_PREF}), or restart it yourself.`,
  };
}

/** Field codes a launcher passes files and URIs through — meaningless with no document to open. */
const DESKTOP_FIELD_CODES = /^%[fFuUdDnNickvm]$/;

/**
 * The command line that relaunches a browser from its *activated* entry.
 *
 * Built from the override's own `Exec=`, not handed to `gio launch`, which
 * takes trailing arguments as files to open — the restore flag would arrive
 * as a URL. Running the Exec verbatim also carries the activation prefix,
 * which is what brings the tree back.
 */
export function relaunchCommand(
  activatedExec: string,
  command: string,
): { command: string; args: string[] } | null {
  const tokens = (activatedExec.match(/"[^"]*"|\S+/g) ?? [])
    .map((token) => token.replace(/^"|"$/g, ''))
    .filter((token) => !DESKTOP_FIELD_CODES.test(token));
  if (tokens.length === 0) return null;

  const args = tokens.slice(1);
  if (!isGeckoBrowser(command)) args.push(CHROMIUM_RESTORE_FLAG);
  return { command: tokens[0], args };
}

/** The `Exec=` of an activated entry, or null when it has none. */
export function readActivatedExec(
  desktopFileName: string,
  targetDirectory: string,
): string | null {
  try {
    const contents = readFileSync(join(targetDirectory, desktopFileName), 'utf-8');
    for (const line of contents.split(/\r?\n/)) {
      if (line.startsWith('Exec=')) return line.slice('Exec='.length);
    }
  } catch {
    // A missing override means activation never ran; nothing to relaunch.
  }
  return null;
}
