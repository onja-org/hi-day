import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVATION_FLAG } from './browser-activation';

/**
 * A browser running without an accessibility tree, and so invisible to URL
 * tracking: `browser-activation.ts` is a launch-time switch, so one already
 * open when the agent installed stays untracked until it is restarted.
 *
 * Found by the activation flag in the process's own command line, since the
 * rewrite appends it to every entry whatever the engine, and arguments
 * survive the snap and flatpak wrappers that strip environment variables.
 * Neither start time nor install directory works: Chrome's entry runs a
 * wrapper (`/usr/bin/google-chrome-stable`) while the process is
 * `/opt/google/chrome/chrome`, and `/snap/bin/firefox` resolves to
 * `/usr/bin/snap`.
 */
export interface BlindBrowser {
  pid: number;
  /** `comm` from /proc — the executable name, e.g. "firefox" or "chrome". */
  command: string;
}

export interface BrowserProcess {
  pid: number;
  command: string;
  /** Argument vector, already split on NULs. */
  cmdline: string[];
  /** Resolved `/proc/<pid>/exe`, or the command when it cannot be read. */
  executablePath: string;
}

/**
 * Words from a browser's `.desktop` filename that identify its process —
 * derived from the discovered entries, so a browser released tomorrow is
 * covered. Vendor and packaging words are dropped: `google` would claim
 * Google Drive, `stable` would claim anything.
 */
const FILENAME_NOISE = new Set([
  'com',
  'org',
  'desktop',
  'google',
  'microsoft',
  'mozilla',
  'stable',
  'browser',
  'www',
  'app',
]);

export function browserTokens(desktopFileNames: string[]): string[] {
  const tokens = new Set<string>();
  for (const fileName of desktopFileNames) {
    for (const part of fileName.replace(/\.desktop$/, '').split(/[._\-\s]+/)) {
      const token = part.toLowerCase();
      if (token.length > 3 && !FILENAME_NOISE.has(token)) tokens.add(token);
    }
  }
  return [...tokens];
}

/**
 * A browser's own helper processes, so only the main one is counted. Both
 * engines fork the same binary for their children, so only the arguments
 * tell them apart — Chromium uses `--type=`, Gecko `-contentproc`. Missing
 * the Gecko form listed nine Firefox internals as browsers to restart.
 */
const CHILD_PROCESS_ARGS = ['--type=', '-contentproc'];

/** Browsers running without the activation flag, and so without a tree. */
export function selectBlindBrowsers(
  processes: BrowserProcess[],
  tokens: string[],
): BlindBrowser[] {
  return processes
    .filter((process) => isBrowserProcess(process, tokens))
    .filter(
      (process) =>
        !process.cmdline.some((arg) =>
          CHILD_PROCESS_ARGS.some((marker) => arg.startsWith(marker)),
        ),
    )
    .filter((process) => !process.cmdline.some((arg) => arg.startsWith(ACTIVATION_FLAG.split('=')[0])))
    .map((process) => ({ pid: process.pid, command: process.command }));
}

/**
 * Helpers that ship inside browsers and Electron apps alike. Every Electron
 * app bundles `chrome_crashpad_handler`, so a name match alone claims Slack
 * and VS Code — and restarting one would open a browser in its place.
 */
const HELPER_BINARY_WORDS = ['crashpad', 'handler', 'zygote', 'sandbox', 'helper', 'updater'];

/** Matched on the executable's filename: a path match would claim anything
 * under a vendor directory, and `comm` is truncated to 15 characters. */
export function isBrowserProcess(
  process: BrowserProcess,
  tokens: string[],
): boolean {
  const binary = (process.executablePath.split('/').pop() ?? '').toLowerCase();
  if (HELPER_BINARY_WORDS.some((word) => binary.includes(word))) return false;
  return tokens.some((token) => binary.includes(token));
}

/**
 * A browser's name as people read it. `comm` arrives lowercase from /proc,
 * and capitalising at the source keeps every sentence that mentions a
 * browser agreeing with every other.
 */
export function displayName(command: string): string {
  return command.charAt(0).toUpperCase() + command.slice(1);
}

/** Every process this user owns, with what it is and how it was started. */
export function readBrowserProcesses(procRoot = '/proc'): BrowserProcess[] {
  const processes: BrowserProcess[] = [];
  for (const entry of safeReaddir(procRoot)) {
    const pid = Number(entry);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    try {
      const command = readFileSync(join(procRoot, entry, 'comm'), 'utf-8').trim();
      // Whitespace as well as NUL: Chrome rewrites its own argv, leaving
      // `cmdline` one space-separated blob. On NUL alone every flag was
      // invisible and every Chrome process looked blind.
      const cmdline = readFileSync(join(procRoot, entry, 'cmdline'), 'utf-8')
        .split(/[\0\s]+/)
        .filter((arg) => arg.length > 0);
      if (cmdline.length === 0) continue;

      let executablePath = cmdline[0];
      try {
        executablePath = realpathSync(join(procRoot, entry, 'exe'));
      } catch {
        // Unreadable for a process we do not own; the argv path still names it.
      }
      processes.push({ pid, command, cmdline, executablePath });
    } catch {
      // A process that exited mid-scan is ordinary, not an error.
    }
  }
  return processes;
}

function safeReaddir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
