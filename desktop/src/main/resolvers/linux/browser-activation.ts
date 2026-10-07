import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Makes browsers expose the address bar this resolver reads.
 *
 * A Linux browser builds an accessibility tree only if accessibility was
 * active when it started, so this is a launch-time concern: each browser's
 * `.desktop` entry is shadowed rather than any desktop setting changed.
 * `toolkit-accessibility` was the old advice and is user-revocable;
 * `ScreenReaderEnabled` is worse still, since GNOME then launches Orca.
 *
 * Measured on GNOME 46 with every accessibility setting off: Chrome, Edge,
 * Brave and Opera each expose 2-3 nodes and no address bar unmodified, and
 * a full tree with the rewrite; Firefox is absent from the bus entirely
 * until it gets the environment variable.
 *
 * No browser is exempt — Chrome only looked exempt because that instance
 * had started while a screen reader was running. One rewrite covers every
 * browser, so there is no registry and no per-browser code here: Firefox
 * ignores the Chromium flag, Chromium ignores the Gecko variable, and a
 * browser released tomorrow is covered.
 *
 * `=basic` exposes the browser UI without building a tree over page
 * content, which is the expensive part.
 */

/** Gecko builds an accessibility tree at startup when this is set. */
const ACTIVATION_ENV_NAME = 'GNOME_ACCESSIBILITY';
const ACTIVATION_ENV_ASSIGNMENT = `${ACTIVATION_ENV_NAME}=1`;

/** Chromium's own switch. `basic` skips the page-content tree; see above. */
export const ACTIVATION_FLAG = '--force-renderer-accessibility=basic';

/**
 * Marks a file as ours. Written into every override so a later run can tell
 * its own output from a vendor entry — and so uninstall removes only files
 * this agent created.
 */
export const ACTIVATION_MARKER = '# Written by Hi Day to enable website tracking.';

/**
 * The marker this agent wrote before it was renamed from Workforce Monitor.
 * Still counted as ours, so an upgraded install neither re-wraps the
 * overrides the old name left behind nor strands them on uninstall (see
 * build/afterRemove.sh, which checks both too).
 */
export const LEGACY_ACTIVATION_MARKERS = ['# Written by Workforce Monitor to enable website tracking.'];

/** Whether a `.desktop` file is one of this agent's overrides, under any of its names. */
export function isOwnOverride(contents: string): boolean {
  return [ACTIVATION_MARKER, ...LEGACY_ACTIVATION_MARKERS].some((marker) => contents.includes(marker));
}

/**
 * A `.desktop` entry declaring itself a handler for `http` is the
 * freedesktop-standard way of saying "I am a web browser". Keying off it
 * rather than a list of known browser names is what lets an unknown or
 * newly released browser work without being added anywhere.
 */
export function isBrowserDesktopEntry(contents: string): boolean {
  return contents
    .split(/\r?\n/)
    .some((line) => line.startsWith('MimeType=') && line.includes('x-scheme-handler/http'));
}

/**
 * Splits an `Exec=` value into tokens, honouring the double quotes the
 * desktop-entry spec allows around arguments containing spaces.
 */
function tokenizeExec(value: string): string[] {
  const tokens = value.match(/"[^"]*"|\S+/g);
  return tokens ?? [];
}

function isEnvAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

/** `flatpak run` takes its own options before the app id and forwards everything after it to the app. */
const FLATPAK_ENV_OPTION = `--env=${ACTIVATION_ENV_ASSIGNMENT}`;

function isFlatpakRun(tokens: string[], execIndex: number): boolean {
  const command = tokens[execIndex]?.split('/').pop();
  return command === 'flatpak' && tokens.slice(execIndex + 1).includes('run');
}

/**
 * Rewrites a `flatpak run` command, which the generic path gets wrong in
 * both halves.
 *
 * Inserting the Chromium flag after the executable hands it to `flatpak`
 * itself, which does not recognise it and refuses to start — the launcher
 * breaks and the browser simply stops opening. It has to go after the app
 * id, where flatpak forwards arguments to the application.
 *
 * `env VAR=1 flatpak run ...` is equally useless: the variable is set for
 * the flatpak client, not inside the sandbox the browser runs in. Flatpak's
 * own `--env=` option is what crosses that boundary.
 *
 * Observed on Pop!_OS with Opera installed from Pop!_Shop, which installs
 * flatpaks: our override left Opera unable to launch at all.
 */
function activateFlatpakExec(tokens: string[], execIndex: number): string {
  const runIndex = tokens.indexOf('run', execIndex + 1);

  // The app id is the first token after `run` that is not an option.
  let appIdIndex = runIndex + 1;
  while (appIdIndex < tokens.length && tokens[appIdIndex].startsWith('-')) {
    appIdIndex += 1;
  }
  if (appIdIndex >= tokens.length) return tokens.join(' ');

  const rewritten = [...tokens];
  rewritten.splice(appIdIndex + 1, 0, ACTIVATION_FLAG);
  rewritten.splice(runIndex + 1, 0, FLATPAK_ENV_OPTION);
  return rewritten.join(' ');
}

/**
 * Rewrites one `Exec=` value. Idempotent — a previous run's additions are
 * stripped first. The flag goes immediately after the executable, since the
 * value ends in field codes (`%U`) the desktop replaces with a URL — except
 * for a `flatpak run` launcher, where the executable is flatpak rather than
 * the browser; see activateFlatpakExec.
 */
export function activateExecValue(value: string): string {
  const tokens = tokenizeExec(value);
  if (tokens.length === 0) return value;

  const stripped = tokens.filter(
    (token) =>
      token !== ACTIVATION_FLAG &&
      token !== FLATPAK_ENV_OPTION &&
      !token.startsWith(`${ACTIVATION_ENV_NAME}=`),
  );

  // A bare `env` we prefixed last time, now with nothing left behind it.
  if (stripped[0] === 'env' && stripped.length > 1 && !isEnvAssignment(stripped[1])) {
    stripped.shift();
  }
  if (stripped.length === 0) return value;

  // The executable is the first token that is neither `env` nor one of its
  // VAR=VALUE assignments — an entry may legitimately already use `env`.
  let execIndex = 0;
  if (stripped[0] === 'env') {
    execIndex = 1;
    while (execIndex < stripped.length && isEnvAssignment(stripped[execIndex])) {
      execIndex += 1;
    }
  }
  if (execIndex >= stripped.length) return value;

  if (isFlatpakRun(stripped, execIndex)) return activateFlatpakExec(stripped, execIndex);

  const rewritten = [...stripped];
  rewritten.splice(execIndex + 1, 0, ACTIVATION_FLAG);
  if (stripped[0] === 'env') {
    rewritten.splice(1, 0, ACTIVATION_ENV_ASSIGNMENT);
  } else {
    rewritten.unshift('env', ACTIVATION_ENV_ASSIGNMENT);
  }

  return rewritten.join(' ');
}

/**
 * Rewrites **every** `Exec=` line in an entry, not just the first. Browser
 * entries carry Desktop Actions ("New Window", "New Incognito Window") with
 * their own `Exec=` lines — Firefox's has four in total, Brave's three.
 * Rewriting only the first would leave a window opened from the launcher's
 * right-click menu silently untracked.
 */
export function activateDesktopEntry(contents: string): string {
  const body = contents
    .split(/\r?\n/)
    .map((line) => (line.startsWith('Exec=') ? `Exec=${activateExecValue(line.slice(5))}` : line))
    .join('\n');

  return isOwnOverride(contents) ? body : `${ACTIVATION_MARKER}\n${body}`;
}

export interface DiscoveredBrowser {
  /** Basename, e.g. `brave_brave.desktop`. The override must reuse it. */
  fileName: string;
  /** Absolute path of the vendor entry this was read from. */
  sourcePath: string;
  contents: string;
}

/**
 * The directories a desktop environment reads application entries from,
 * lowest precedence first, per the XDG base-directory spec.
 */
export function applicationDirectories(env: NodeJS.ProcessEnv = process.env): string[] {
  const dataDirs = (env.XDG_DATA_DIRS ?? '/usr/local/share/:/usr/share/')
    .split(':')
    .filter((entry) => entry.length > 0);
  const dataHome = env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
  return [...dataDirs, dataHome].map((dir) => join(dir, 'applications'));
}

/**
 * `system` belongs on a managed device: it needs root and outranks both
 * `/usr/share` and snapd's directory. `user` works without root but sits in
 * the employee's home directory, where they can remove it.
 */
export function activationTargetDirectory(
  scope: 'system' | 'user',
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (scope === 'system') return '/usr/local/share/applications';
  const dataHome = env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
  return join(dataHome, 'applications');
}

/**
 * Finds every browser entry on the system, ignoring this agent's own
 * overrides so a second run reads vendor entries rather than its own output.
 * Later directories win, matching XDG precedence, so a browser shipping
 * entries in two places is activated once, from the one that actually runs.
 */
export function discoverBrowserEntries(directories: string[]): DiscoveredBrowser[] {
  const found = new Map<string, DiscoveredBrowser>();

  for (const directory of directories) {
    let fileNames: string[];
    try {
      fileNames = readdirSync(directory);
    } catch {
      continue; // A directory in XDG_DATA_DIRS need not exist.
    }

    for (const fileName of fileNames) {
      if (!fileName.endsWith('.desktop')) continue;
      const sourcePath = join(directory, fileName);

      let contents: string;
      try {
        contents = readFileSync(sourcePath, 'utf-8');
      } catch {
        continue; // Unreadable entry: skip it rather than fail the sweep.
      }

      if (isOwnOverride(contents)) continue;
      if (!isBrowserDesktopEntry(contents)) continue;

      found.set(fileName, { fileName, sourcePath, contents });
    }
  }

  return [...found.values()];
}

export interface ActivationOutcome {
  fileName: string;
  /** Absolute path written, or that writing was attempted at. */
  targetPath: string;
  /** False when the override could not be written — `reason` says why. */
  activated: boolean;
  /** True when the override was already correct and nothing was written. */
  unchanged?: boolean;
  /**
   * True when no override existed here before: this install's first sweep.
   * Distinguished from a rewrite because it is what a fresh install looks
   * like — uninstall removes these files (see build/afterRemove.sh), so
   * their absence is the only durable record of "never activated here",
   * and the first-run browser-restart screen keys off it.
   */
  created?: boolean;
  reason?: string;
}

/**
 * Every `Exec=` line of an entry, which is all of it this agent changes.
 *
 * Comparing these rather than whole files is what stops a vendor update from
 * re-shadowing a launcher for nothing. A browser that updates itself rewrites
 * its entry regularly — a new translated `Comment[de]`, a changed icon path —
 * and every rewrite of ours replaces the winning `.desktop` file underneath
 * whatever windows that browser has open, costing them their desktop binding
 * (see selectRunningBrowsers). Those updates are frequent; genuine command
 * changes are rare. The cost is that an override keeps the name, icon and
 * translations it was created with until the command itself changes.
 */
export function execLines(contents: string): string[] {
  return contents.split(/\r?\n/).filter((line) => line.startsWith('Exec='));
}

export interface ActivationReport {
  scope: 'system' | 'user';
  targetDirectory: string;
  outcomes: ActivationOutcome[];
}

/**
 * Writes an activated copy of every browser entry found. Runs at agent
 * startup, so browsers opened later are already activated. One already
 * running keeps its empty tree until next launched; `blind-browsers.ts`
 * finds those. An entry whose content already matches is left alone rather
 * than rewritten, so this stops touching the user's files on every launch.
 */
export function applyBrowserActivation(options: {
  scope: 'system' | 'user';
  env?: NodeJS.ProcessEnv;
}): ActivationReport {
  const env = options.env ?? process.env;
  const targetDirectory = activationTargetDirectory(options.scope, env);
  const sources = discoverBrowserEntries(
    applicationDirectories(env).filter((dir) => dir !== targetDirectory),
  );

  const outcomes: ActivationOutcome[] = [];
  for (const source of sources) {
    const targetPath = join(targetDirectory, source.fileName);
    try {
      mkdirSync(targetDirectory, { recursive: true });
      const desired = activateDesktopEntry(source.contents);
      const existing = existsSync(targetPath)
        ? readFileSync(targetPath, 'utf-8')
        : null;
      if (
        existing !== null &&
        execLines(existing).join('\n') === execLines(desired).join('\n')
      ) {
        outcomes.push({
          fileName: source.fileName,
          targetPath,
          activated: true,
          unchanged: true,
        });
        continue;
      }
      writeFileSync(targetPath, desired, 'utf-8');
      outcomes.push({
        fileName: source.fileName,
        targetPath,
        activated: true,
        created: existing === null,
      });
    } catch (error) {
      outcomes.push({
        fileName: source.fileName,
        targetPath,
        activated: false,
        reason: String(error),
      });
    }
  }

  return { scope: options.scope, targetDirectory, outcomes };
}

/**
 * Removes every override this agent wrote, and nothing else — the marker
 * check means a vendor entry that happens to share a filename is left
 * alone. Called on uninstall: we are shadowing the user's browser launchers
 * and must not keep doing so after the agent is gone.
 */
export function removeBrowserActivation(options: {
  scope: 'system' | 'user';
  env?: NodeJS.ProcessEnv;
}): string[] {
  const targetDirectory = activationTargetDirectory(options.scope, options.env ?? process.env);
  if (!existsSync(targetDirectory)) return [];

  const removed: string[] = [];
  let fileNames: string[];
  try {
    fileNames = readdirSync(targetDirectory);
  } catch {
    return [];
  }

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.desktop')) continue;
    const path = join(targetDirectory, fileName);
    try {
      if (!isOwnOverride(readFileSync(path, 'utf-8'))) continue;
      rmSync(path);
      removed.push(path);
    } catch {
      continue;
    }
  }

  return removed;
}
