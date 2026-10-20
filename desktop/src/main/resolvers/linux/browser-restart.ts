import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { displayName } from './blind-browsers';
import type { OpenProfiles } from './browser-profiles';
import { readSessionEnvironment } from './support-gate';

/**
 * Restarting a blind browser so it comes back with an accessibility tree.
 *
 * Destructive by nature — whatever is unsaved dies with the process, and no
 * flag restores that — so it never runs on its own, only on the button, and
 * only against browsers that are actually blind.
 *
 * Chromium reopens its tabs from `--restore-last-session` whatever the
 * person's startup preference. Firefox has no such flag and reopens them
 * only when `browser.startup.page` is 3; otherwise it is still restarted,
 * with the banner pointing at History > Restore Previous Session.
 */
export const CHROMIUM_RESTORE_FLAG = '--restore-last-session';

/** `browser.startup.page = 3` is "Show my windows and tabs from last time". */
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

/**
 * What to warn someone about before this browser is restarted, if anything.
 *
 * Every browser is restarted now, Firefox included. Chromium reopens its
 * session from `--restore-last-session` whatever the person's settings;
 * Firefox only does so when `browser.startup.page` is 3, and otherwise needs
 * History > Restore Previous Session by hand — so say so rather than let the
 * tabs appear lost.
 */
export function restartWarning(
  command: string,
  firefoxRestores: boolean,
): string | null {
  if (!isGeckoBrowser(command) || firefoxRestores) return null;
  return `${displayName(command)} won't reopen its tabs on its own — use History > Restore Previous Session.`;
}

/**
 * Placeholders a launcher fills with files to open — meaningless with no
 * document to pass. `@@`/`@@u` are flatpak's file-forwarding markers, which
 * reach the browser as literal arguments if left in.
 */
const LAUNCHER_PLACEHOLDERS = /^(%[fFuUdDnNickvm]|@@u?)$/;

/**
 * Strips one matching pair of surrounding quotes, of either kind.
 *
 * The desktop-entry spec only ever quotes with `"`, but real vendor entries
 * use `'` too — the snap-packaged Vivaldi ships
 * `Exec=... '--class=Vivaldi-snap' %U`. These tokens become an argv, which no
 * shell ever sees, so a quote left on is part of the argument: Chromium read
 * `'--class=Vivaldi-snap'` as something to open rather than as a flag,
 * silently dropping the class it names and opening a tab for the junk string.
 *
 * Matched pairs only, so a token holding one quote of its own keeps it.
 */
function unquote(token: string): string {
  const quoted = /^(["'])([\s\S]*)\1$/.exec(token);
  return quoted ? quoted[2] : token;
}

/**
 * Which profile a Gecko browser was on, taken from its own argument vector.
 * Firefox runs one process per profile and names it with `-P`, so unlike
 * Chromium the live argv does say — see browser-profiles.ts for why the two
 * engines need different answers.
 */
export function geckoProfileArguments(cmdline: string[]): string[] {
  const flag = cmdline.findIndex((arg) => arg === '-P' || arg === '--profile');
  const value = flag === -1 ? undefined : cmdline[flag + 1];
  return value === undefined ? [] : ['--profile', value];
}

/**
 * The command line that relaunches a browser from its *activated* entry.
 *
 * Built from the override's own `Exec=`, not handed to `gio launch`, which
 * takes trailing arguments as files to open — the restore flag would arrive
 * as a URL. Running the Exec verbatim also carries the activation prefix,
 * which is what brings the tree back.
 */
/**
 * The environment a relaunched browser should get.
 *
 * Electron overwrites `XDG_CURRENT_DESKTOP` with `Unity` in its own process
 * and keeps the real value in `ORIGINAL_XDG_CURRENT_DESKTOP` (see
 * support-gate.ts, where the same rewrite once made a GNOME session report
 * as unsupported). A browser spawned from here inherits that, reads `Unity`,
 * and lays its window out accordingly — which on Chromium means the close
 * button moves to the top *left*, because that is where Unity put it.
 *
 * So a browser restarted by the app looked subtly unlike the same browser
 * launched from the dock. Putting the real value back makes the two
 * indistinguishable, which is the whole point of offering the restart.
 */
export function relaunchEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const { currentDesktop } = readSessionEnvironment(env);
  if (!currentDesktop) return env;

  const relaunch: NodeJS.ProcessEnv = {
    ...env,
    XDG_CURRENT_DESKTOP: currentDesktop,
  };
  // Electron's own bookkeeping, which means nothing to a browser.
  delete relaunch.ORIGINAL_XDG_CURRENT_DESKTOP;
  return relaunch;
}

export function relaunchCommand(
  activatedExec: string,
  command: string,
  cmdline: string[] = [],
): { command: string; args: string[] } | null {
  const tokens = (activatedExec.match(/"[^"]*"|'[^']*'|\S+/g) ?? [])
    .map(unquote)
    .filter((token) => !LAUNCHER_PLACEHOLDERS.test(token));
  if (tokens.length === 0) return null;

  const args = tokens.slice(1);
  if (isGeckoBrowser(command)) args.push(...geckoProfileArguments(cmdline));
  else args.push(CHROMIUM_RESTORE_FLAG);
  return { command: tokens[0], args };
}

/**
 * Every launch needed to put a browser back the way it was — one per open
 * Chromium profile, and a single launch for everything else.
 *
 * Naming a profile is what stops the picker appearing: Chromium opens the
 * profile it was given and asks nothing. The second and later launches are
 * not new browsers — they reach the instance the first one started through
 * its own singleton, which opens a window for that profile.
 */
export function relaunchCommands(
  activatedExec: string,
  command: string,
  cmdline: string[] = [],
  open: OpenProfiles = { userDataDir: null, profiles: [] },
): { command: string; args: string[] }[] {
  const base = relaunchCommand(activatedExec, command, cmdline);
  if (!base) return [];
  if (isGeckoBrowser(command) || open.profiles.length === 0) return [base];

  // Only when they chose the location themselves: the path read back from
  // /proc is the one the browser actually resolved, which for a snap or
  // flatpak is not the one it would resolve again from inside its sandbox.
  const args = cmdline.some((arg) => arg.startsWith('--user-data-dir=')) && open.userDataDir
    ? [...base.args, `--user-data-dir=${open.userDataDir}`]
    : base.args;

  return open.profiles.map((profile) => ({
    command: base.command,
    args: [...args, `--profile-directory=${profile}`],
  }));
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
