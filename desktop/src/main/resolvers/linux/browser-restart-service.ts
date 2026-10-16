import { spawn } from 'node:child_process';
import {
  browserTokens,
  displayName,
  readBrowserProcesses,
  selectBlindBrowsers,
  selectRunningBrowsers,
  type BlindBrowser,
  type BrowserProcess,
} from './blind-browsers';
import { readOpenProfiles } from './browser-profiles';
import type { DiscoveredBrowser } from './browser-activation';
import {
  activationTargetDirectory,
  discoverBrowserEntries,
  applicationDirectories,
} from './browser-activation';
import {
  firefoxRestoresSession,
  readActivatedExec,
  readFirefoxPrefs,
  relaunchCommands,
  restartWarning,
  type RestartOutcome,
} from './browser-restart';

/** A blind browser we can also relaunch, because we found its entry. */
export interface RestartableBrowser extends BlindBrowser {
  desktopFileName: string;
}

export interface BlindBrowserReport {
  /** Blind browsers we can relaunch ourselves. */
  restartable: RestartableBrowser[];
  /** Blind browsers with no launcher to relaunch them from, and why. */
  manual: { browser: BlindBrowser; reason: string }[];
  /** What to tell someone before they press the button. */
  warnings: string[];
}

/**
 * The `.desktop` entry a running browser came from, matched on the longest
 * shared word — `chrome` picks `google-chrome.desktop` over `firefox`, and
 * the longest match keeps `vivaldi-stable` from being claimed by a shorter
 * token that also appears in it.
 */
function entryFor(
  command: string,
  entries: DiscoveredBrowser[],
): string | undefined {
  const name = command.toLowerCase();
  return entries
    .map((entry) => {
      const stem = entry.fileName.replace(/\.desktop$/, '').toLowerCase();
      const shared = stem
        .split(/[._\-\s]+/)
        .filter((part) => part.length > 3 && name.includes(part))
        .sort((a, b) => b.length - a.length)[0];
      return shared ? { fileName: entry.fileName, length: shared.length } : null;
    })
    .filter((match): match is { fileName: string; length: number } => match !== null)
    .sort((a, b) => b.length - a.length)[0]?.fileName;
}

/**
 * How long a browser gets to shut down before the relaunch is abandoned.
 * Four seconds was enough for Chromium and not for Firefox, which saves its
 * session on the way out and routinely takes longer — so it was killed and
 * never came back.
 */
const SHUTDOWN_GRACE_MS = 20_000;

/** How long the first launch gets to come up before the rest are sent to it. */
const START_GRACE_MS = 10_000;

/**
 * Finds browsers running without an accessibility tree, and restarts them on
 * request. Linux only, and only against genuinely blind ones — restarting an
 * already-tracked browser would cost someone their tabs for nothing.
 */
export class BrowserRestartService {
  constructor(
    private readonly deps: {
      logger?: (line: string) => void;
      env?: NodeJS.ProcessEnv;
      /** Overridden only by tests, which cannot wait out a real shutdown. */
      shutdownGraceMs?: number;
    } = {},
  ) {}

  private log(line: string): void {
    this.deps.logger?.(line);
  }

  /** Blind browsers right now, split by whether we can safely restart them. */
  findBlind(): BlindBrowserReport {
    return this.report(selectBlindBrowsers);
  }

  /**
   * Every browser open right now, blind or not, in the same shape.
   *
   * What the first-run screen asks about: shadowing the launchers orphans the
   * windows of every browser already open, not only the untracked ones — see
   * selectRunningBrowsers.
   */
  findRunning(): BlindBrowserReport {
    return this.report(selectRunningBrowsers);
  }

  private report(
    select: (processes: BrowserProcess[], tokens: string[]) => BlindBrowser[],
  ): BlindBrowserReport {
    const env = this.deps.env ?? process.env;
    const targetDirectory = activationTargetDirectory('user', env);
    const entries = discoverBrowserEntries(
      applicationDirectories(env).filter((dir) => dir !== targetDirectory),
    );
    const tokens = browserTokens(entries.map((entry) => entry.fileName));
    if (tokens.length === 0) return { restartable: [], manual: [], warnings: [] };

    const blind = select(readBrowserProcesses(), tokens);
    const firefoxRestores = firefoxRestoresSession(readFirefoxPrefs());

    const report: BlindBrowserReport = {
      restartable: [],
      manual: [],
      warnings: [],
    };
    for (const browser of blind) {
      const desktopFileName = entryFor(browser.command, entries);
      if (!desktopFileName) {
        // Nothing to relaunch it from; saying so beats a button that does
        // nothing when pressed.
        report.manual.push({
          browser,
          reason: `Restart ${displayName(browser.command)} yourself.`,
        });
        continue;
      }
      report.restartable.push({ ...browser, desktopFileName });
      const warning = restartWarning(browser.command, firefoxRestores);
      if (warning && !report.warnings.includes(warning)) {
        report.warnings.push(warning);
      }
    }
    return report;
  }

  /**
   * Ends each browser and launches it again through its activated entry.
   *
   * `SIGTERM`, never `SIGKILL`: the clean shutdown is what writes the session
   * out, and the grace period lets it finish — relaunching into a profile the
   * old process still holds trips the "already running" lock.
   */
  async restart(browsers: RestartableBrowser[]): Promise<RestartOutcome[]> {
    const env = this.deps.env ?? process.env;
    const targetDirectory = activationTargetDirectory('user', env);
    const outcomes: RestartOutcome[] = [];

    for (const browser of browsers) {
      const exec = readActivatedExec(browser.desktopFileName, targetDirectory);
      // Read while it is still running: the open files are what name the
      // profiles, and they are gone the moment the process is.
      const open = readOpenProfiles(browser.pid);
      const relaunches = exec
        ? relaunchCommands(exec, browser.command, browser.cmdline, open)
        : [];
      if (relaunches.length === 0) {
        outcomes.push({
          pid: browser.pid,
          command: browser.command,
          restarted: false,
          reason: 'No activated launcher to start it from.',
        });
        continue;
      }

      try {
        process.kill(browser.pid, 'SIGTERM');
      } catch (error) {
        outcomes.push({
          pid: browser.pid,
          command: browser.command,
          restarted: false,
          reason: String(error),
        });
        continue;
      }

      const grace = this.deps.shutdownGraceMs ?? SHUTDOWN_GRACE_MS;
      if (!(await waitForExit(browser.pid, grace))) {
        // Launching now would meet a profile lock the dying process still
        // holds, and the new instance would exit on the spot — leaving the
        // browser closed rather than restarted, which is worse than never
        // having touched it. It is still on its way out, so the next launch
        // starts from the activated entry anyway.
        outcomes.push({
          pid: browser.pid,
          command: browser.command,
          restarted: false,
          reason: 'Still shutting down — reopen it yourself.',
        });
        continue;
      }

      try {
        // One launch per profile, never at once: the first starts the
        // browser, and the rest only reach it through the singleton lock it
        // writes on the way up. Fired together they race that lock, and the
        // losers exit without ever opening their window.
        const before = pidsNamed(browser.command);
        for (const [index, relaunch] of relaunches.entries()) {
          if (index > 0 && !(await waitForStart(browser.command, before, START_GRACE_MS))) {
            break;
          }
          // Detached, so the browser outlives this agent rather than dying
          // with it — it is the person's browser, not our child process.
          spawn(relaunch.command, relaunch.args, {
            detached: true,
            stdio: 'ignore',
          }).unref();
        }
        if (relaunches.length > 1) {
          this.log(
            `[browser-restart] ${browser.command}#${browser.pid} reopened ${relaunches.length} profiles: ${open.profiles.join(', ')}`,
          );
        }
        outcomes.push({ pid: browser.pid, command: browser.command, restarted: true });
      } catch (error) {
        outcomes.push({
          pid: browser.pid,
          command: browser.command,
          restarted: false,
          reason: String(error),
        });
      }
    }

    // One line each, not only the tally. A count cannot say whether a browser
    // refused the signal, had no launcher, or was still shutting down — and
    // when three of four silently failed, the count was all there was to go on.
    for (const outcome of outcomes.filter((o) => !o.restarted)) {
      this.log(
        `[browser-restart] ${outcome.command}#${outcome.pid} not restarted: ${outcome.reason ?? 'no reason given'}`,
      );
    }
    this.log(
      `[browser-restart] ${outcomes.filter((o) => o.restarted).length}/${outcomes.length} restarted`,
    );
    return outcomes;
  }
}

/** Resolves once the process is gone, or when the grace period runs out. */
/** Whether the process actually went, rather than merely being asked to. */
/**
 * Whether the browser we just launched is up and holding the singleton the
 * next launch needs to reach it.
 *
 * Keyed on a process that was not there before, not merely on the name: a
 * second browser sharing the name would answer yes on the spot, and the
 * profiles behind it would race the lock they were waiting for.
 */
async function waitForStart(
  command: string,
  before: Set<number>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const started = readBrowserProcesses().some(
      (process) =>
        process.command === command &&
        !before.has(process.pid) &&
        !process.cmdline.some((arg) => arg.startsWith('--type=')),
    );
    if (started) return true;
  }
  return false;
}

function pidsNamed(command: string): Set<number> {
  return new Set(
    readBrowserProcesses()
      .filter((process) => process.command === command)
      .map((process) => process.pid),
  );
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}
