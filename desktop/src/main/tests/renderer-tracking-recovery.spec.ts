import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Runs the real renderer in jsdom against a stubbed `window.api`, to pin how
 * tracking setup behaves when its first requests fail.
 *
 * The case this exists for: the app autostarts at OS login, often before the
 * network is up, so the first `listProjects` answers "Could not reach the
 * server". That load used to run exactly once — the list stayed empty, the
 * real error was replaced by "No projects are available to track time
 * against.", and only logging out and back in (which reruns setup) fixed it.
 *
 * Lives under main/tests rather than beside the renderer because vitest only
 * collects `src/main`.
 */
const RENDERER_DIR = join(__dirname, '..', '..', 'renderer');

/** Shrunk so a retry on the poll cadence lands within a short real-time wait. */
const FAST_POLL_MS = 50;

function rendererScript(pollMs: number, idlePollMs: number): string {
  // The renderer is a module in the app but is eval'd as a plain script
  // here, so its local imports are inlined rather than resolved.
  const imported = ['reminder-message.ts', 'idle-hold.ts']
    .map((file) => readFileSync(join(RENDERER_DIR, file), 'utf8').replace(/^export /gm, ''))
    .join('\n');
  const source =
    imported +
    readFileSync(join(RENDERER_DIR, 'renderer.ts'), 'utf8')
      .replace(/^import .*from "\.\/reminder-message\.js";$/m, '')
      .replace(/^import \{[^}]*\} from "\.\/idle-hold\.js";$/m, '');
  const fastSource = source
    .replace(
      'const STATUS_POLL_INTERVAL_MS = 15_000;',
      `const STATUS_POLL_INTERVAL_MS = ${pollMs};`,
    )
    .replace(
      'const IDLE_POLL_INTERVAL_MS = 10_000;',
      `const IDLE_POLL_INTERVAL_MS = ${idlePollMs};`,
    );
  // Guards the guard: a renamed constant would silently keep the 15s cadence.
  expect(fastSource).not.toBe(source);
  // A window onto one renderer variable, appended inside its own scope: see
  // `idleRestartInFlight` below.
  const probedSource = `${fastSource}\n(window as any).__idleRestartInFlight = () => idleRestartInFlight;\n`;
  return ts
    .transpileModule(probedSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export \{\};?$/m, '');
}

function rendererMarkup(): string {
  return readFileSync(join(RENDERER_DIR, 'index.html'), 'utf8').replace(
    /<script[\s\S]*?<\/script>/g,
    '',
  );
}

const PROJECT = { id: 'p1', name: 'Project One', colour: '#000000', client: null };
const UNREACHABLE = { ok: false, message: 'Could not reach the server at https://api.hiday.io.' };
/** What main's `callDeviceApi` hands back for a revoked (or locally cleared) session. */
const SIGNED_OUT = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
  unauthorized: true,
  status: 401,
};

interface Scenario {
  /** How many leading `listProjects` calls fail as if the network were down. */
  failingProjectLoads: number;
  projects?: (typeof PROJECT)[];
  /** How many leading `idlePolicy` calls fail as if the network were down. */
  failingIdlePolicyLoads?: number;
  /** A timer already running server-side, e.g. started from the web console. */
  runningElsewhere?: boolean;
  /** Overrides the shrunk poll cadence — a long one means no retry fires on its own. */
  pollMs?: number;
  /** The idle check's own cadence, for a test that wants idle to fire while status polls do not. */
  idlePollMs?: number;
  /** How far the server's count of each entry falls short of this device's clock. */
  serverShortfallSeconds?: number;
  /** The organisation's idle handling; one that never fires unless a test says otherwise. */
  idlePolicy?: { handling: 'off' | 'flag' | 'auto_subtract'; thresholdMinutes: number };
  /** An idle hold main kept on disk from before launch — a sleep, or a relaunch. */
  storedHold?: {
    projectId: string | null;
    taskId: string | null;
    idleStartedAt: string;
    returnedAt: string | null;
    reason: 'timeout' | 'sleep';
  };
  /** Whether the organisation tracks time against Projects; on unless a test says otherwise. */
  projectsEnabled?: boolean;
  /** A daily/weekly work time limit the server reports as already reached. */
  limitReached?: { kind: 'daily' | 'weekly'; limitHours: number };
  /** What main answers when asked whether this launch should start the timer itself. */
  autoStartDue?: boolean;
}

function launch(scenario: Scenario) {
  const dom = new JSDOM(rendererMarkup(), { runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window as unknown as Window & {
    api: unknown;
    eval: (code: string) => void;
    Date: DateConstructor;
  };

  // The renderer's clock, moved forward by `advanceClock` so a test can let
  // minutes pass without waiting for them.
  const clock = { offsetMs: 0 };
  const now = () => Date.now() + clock.offsetMs;
  const RealDate = window.Date;
  window.Date = class extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now());
      else super(...(args as [string]));
    }
    static now() {
      return now();
    }
  } as DateConstructor;

  const calls = {
    listProjects: 0,
    start: 0,
    status: 0,
    idlePolicy: 0,
    autoStartDue: 0,
    /** The project each start named, in order. */
    startedWith: [] as (string | null)[],
    pause: 0,
    /** The project each switch named, in order. */
    switchedTo: [] as (string | null)[],
    /** Bodies passed to main's raise-the-window alert. */
    trackingAlerts: [] as string[],
    /** Bodies passed to the tray's quiet start/stop notification. */
    timerNotices: [] as string[],
    /** How many times the renderer asked main to bring the window forward. */
    shows: 0,
    /** The backdated start each start asked for, in order — undefined for "now". */
    startedAt: [] as (string | undefined)[],
    /** The backdated end each stop asked for, in order. */
    stoppedAt: [] as (string | undefined)[],
  };
  /** Seconds since the last keyboard or mouse input, as main would report it. */
  const idle = { seconds: 0 };
  let heldIdle = scenario.storedHold ?? null;
  const wakeListeners: (() => void)[] = [];
  const entry = {
    id: 'e1',
    projectId: PROJECT.id as string | null,
    taskId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
  };
  let running: typeof entry | null = scenario.runningElsewhere ? entry : null;
  let entrySeq = 1;
  const reopenListeners: (() => void)[] = [];
  const reminderListeners: ((message: string) => void)[] = [];
  const closeRequestListeners: (() => void)[] = [];
  const trayToggleListeners: (() => void)[] = [];
  const trayTrackProjectListeners: ((projectId: string) => void)[] = [];
  const traySignOutListeners: (() => void)[] = [];
  const completed: {
    id: string;
    projectId: string | null;
    durationSeconds: number;
  }[] = [];
  /** Seconds the running entry has on the server's books. */
  const serverWorkedSeconds = () =>
    running
      ? Math.max(
          0,
          Math.floor((now() - new Date(running.startedAt).getTime()) / 1000) -
            (scenario.serverShortfallSeconds ?? 0),
        )
      : 0;
  /** Flip `revoked` mid-test to sign the device out server-side, and set
   * `limitReached` mid-test to have the next poll report a work limit. */
  const server = {
    revoked: false,
    /** Set mid-test to have every start refused, as a work limit would. */
    refuseStarts: false,
    /** What that refusal answers with — 403 is the one that opens a dialog of its own. */
    refuseStartStatus: 409,
    /** Set mid-test to have starts queued rather than sent, as they are with no connection. */
    queueStarts: false,
    /** Set mid-test to have the status read fail outright, as a wake on a dead network does. */
    statusThrows: false,
    /**
     * What `status` reports as the running entry's worked seconds. Set to
     * stand in for the cache's projection, which belongs to the entry that
     * ended rather than the one running now.
     */
    workedSecondsOverride: null as number | null,
    limitReached: scenario.limitReached ?? null as
      | { kind: 'daily' | 'weekly'; limitHours: number }
      | null,
  };
  const ok = <T>(data: T) =>
    Promise.resolve(server.revoked ? SIGNED_OUT : { ok: true, data });

  window.api = {
    trackingAlert: (body: string) => {
      calls.trackingAlerts.push(body);
      return Promise.resolve();
    },
    getStatus: () =>
      Promise.resolve({ loggedIn: true, email: 'a@b.c', name: 'A', organisationName: 'Org' }),
    auth: {
      startPairing: () => ok({}),
      pairingStatus: () => Promise.resolve({ status: 'pending' }),
    },
    logout: () => Promise.resolve({ loggedIn: false }),
    tracking: {
      projectsSetting: () => ok({ projectsEnabled: scenario.projectsEnabled ?? true }),
      listProjects: () => {
        calls.listProjects += 1;
        if (!server.revoked && calls.listProjects <= scenario.failingProjectLoads) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok(scenario.projects ?? [PROJECT]);
      },
      listTasks: () => ok({ tasks: [] }),
      start: (projectId: string | null, _taskId?: string | null, startedAt?: string) => {
        if (server.refuseStarts) {
          return Promise.resolve({
            ok: false,
            message: 'You have reached your daily limit.',
            status: server.refuseStartStatus,
          });
        }
        calls.start += 1;
        calls.startedWith.push(projectId);
        calls.startedAt.push(startedAt);
        const started = {
          ...entry,
          projectId,
          id: `e${++entrySeq}`,
          // Honoured as the backend honours it: a Keep asks to start again
          // back where input stopped, so the entry really is minutes old.
          startedAt: startedAt ?? new Date(now()).toISOString(),
        };
        if (!server.revoked) running = started;
        // An offline start is queued and answered from here, with the time
        // it was pressed — `fromCache` is how the renderer knows.
        if (server.queueStarts) {
          return Promise.resolve({ ok: true, data: started, fromCache: true });
        }
        return ok(started);
      },
      switchTo: (projectId: string | null) => {
        calls.switchedTo.push(projectId);
        return ok(entry);
      },
      stop: (endedAt?: string) => {
        calls.stoppedAt.push(endedAt);
        const ended = { ...(running ?? entry), endedAt: endedAt ?? new Date(now()).toISOString() };
        if (!server.revoked && running) {
          completed.push({
            id: running.id,
            projectId: running.projectId,
            durationSeconds: Math.max(
              0,
              Math.floor(
                (new Date(ended.endedAt).getTime() -
                  new Date(running.startedAt).getTime()) /
                  1000,
              ),
            ),
          });
          running = null;
        }
        return ok(ended);
      },
      status: () => {
        calls.status += 1;
        if (server.statusThrows) return Promise.reject(new Error('no network'));
        return ok({
          entry: running,
          now: new Date(now()).toISOString(),
          workedSeconds: server.workedSecondsOverride ?? serverWorkedSeconds(),
          ...(server.limitReached ? { limitReached: server.limitReached } : {}),
        });
      },
      // Pausing ends the entry, as the backend does now.
      pause: () => {
        calls.pause += 1;
        const ended = { ...(running ?? entry), endedAt: new Date(now()).toISOString() };
        if (!server.revoked && running) {
          completed.push({
            id: running.id,
            projectId: running.projectId,
            durationSeconds: serverWorkedSeconds(),
          });
          running = null;
        }
        return ok(ended);
      },
      resume: () => ok(entry),
      lastProject: () => Promise.resolve(null),
      // Nothing was left running by a crash in these scenarios — the
      // recovery prompt has its own tests.
      // Capture is not paused in these scenarios — the trust window has
      // its own tests.
      capturePaused: () => Promise.resolve(false),
      // Nothing is backed up in these scenarios — the backlog rule has
      // its own tests.
      syncBacklog: () => Promise.resolve(null),
      recoveredTimer: () => Promise.resolve(null),
      answerRecoveredTimer: () => Promise.resolve(),
      entriesBetween: () => ok(completed),
      // The server's overlap-aware totals; these scenarios never overlap, so
      // a plain sum is what it would answer.
      completedTotals: () => {
        const byProject = new Map<string, number>();
        for (const entry of completed) {
          if (entry.projectId === null || entry.durationSeconds === null) continue;
          byProject.set(
            entry.projectId,
            (byProject.get(entry.projectId) ?? 0) + entry.durationSeconds,
          );
        }
        const workedSeconds = completed.reduce(
          (sum, entry) => sum + (entry.durationSeconds ?? 0),
          0,
        );
        return ok({
          workedSeconds,
          deviceSeconds: workedSeconds,
          projects: [...byProject].map(([projectId, seconds]) => ({
            projectId,
            seconds,
          })),
        });
      },
      autoStartDue: () => {
        calls.autoStartDue += 1;
        // Main spends the power-on as it answers, so it only says yes once
        // — however many times setup runs in this renderer.
        return Promise.resolve(
          (scenario.autoStartDue ?? false) && calls.autoStartDue === 1,
        );
      },
      idlePolicy: () => {
        calls.idlePolicy += 1;
        if (!server.revoked && calls.idlePolicy <= (scenario.failingIdlePolicyLoads ?? 0)) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok(scenario.idlePolicy ?? { handling: 'ignore', thresholdMinutes: 5 });
      },
      permissionStatus: () =>
        ok({
          windowTrackingEnabled: false,
          screenshotsEnabled: false,
          platform: 'linux',
          screenRecordingGranted: true,
          accessibilityGranted: true,
          accessibilityGuidance: '',
          waylandUnsupported: false,
        }),
      requestScreenRecordingAccess: () => Promise.resolve(),
      openPrivacySettings: () => Promise.resolve(),
    },
    idle: {
      seconds: () => Promise.resolve(idle.seconds),
      hold: () => Promise.resolve(heldIdle),
      setHold: (hold: NonNullable<typeof heldIdle>) => {
        heldIdle = hold;
        return Promise.resolve();
      },
      markReturned: (at: string) => {
        if (heldIdle && heldIdle.returnedAt === null) heldIdle = { ...heldIdle, returnedAt: at };
        return Promise.resolve(heldIdle);
      },
      clearHold: () => {
        heldIdle = null;
        return Promise.resolve();
      },
      onWake: (listener: () => void) => {
        wakeListeners.push(listener);
      },
    },
    urlCapture: { timerStateChanged: () => {} },
    windowControls: {
      minimise: async () => {},
      show: () => {
        calls.shows += 1;
        return Promise.resolve();
      },
      timerNotice: (body: string) => {
        calls.timerNotices.push(body);
        return Promise.resolve();
      },
      close: async () => {},
      setMode: async () => {},
      onTrackingNotice: () => {},
      onRefusedTime: () => {},
      onCapturePaused: () => {},
      onSyncBacklog: () => {},
      // The quit drain has its own tests; nothing is uploading here.
      onSyncDraining: () => {},
      closeSyncDraining: () => {},
      onTrayToggleTimer: (listener: () => void) => {
        trayToggleListeners.push(listener);
      },
      onTrayTrackProject: (listener: (projectId: string) => void) => {
        trayTrackProjectListeners.push(listener);
      },
      onTraySignOut: (listener: () => void) => {
        traySignOutListeners.push(listener);
      },
      onTrackingReminder: (listener: (message: string) => void) => {
        reminderListeners.push(listener);
      },
      onReopened: (listener: () => void) => {
        reopenListeners.push(listener);
      },
      onCloseRequested: (listener: () => void) => {
        closeRequestListeners.push(listener);
      },
      answerClose: async () => {},
    },
    setup: {
      browserRestartPrompt: () =>
        Promise.resolve({ show: false, names: [], manual: [], warnings: [] }),
      continueFromBrowserRestart: async () => {},
    },
    update: {
      status: () => Promise.resolve({ updateAvailable: false }),
      openReleasesPage: async () => {},
      autoStatus: () => Promise.resolve({ phase: 'idle' }),
    },
  };

  window.eval(
    rendererScript(
      scenario.pollMs ?? FAST_POLL_MS,
      scenario.idlePollMs ?? scenario.pollMs ?? FAST_POLL_MS,
    ),
  );

  const document = dom.window.document;
  /** "HH:MM:SS" on the main timer, as seconds. */
  const timerSeconds = () => {
    const [h, m, s] = document.getElementById('timer-display')!.textContent.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };
  return {
    calls,
    server,
    timerSeconds,
    /** Main's idle reading from now on. */
    setIdleSeconds: (seconds: number) => {
      idle.seconds = seconds;
    },
    /** What main has on disk. */
    heldIdle: () => heldIdle,
    /** Main putting a hold on disk, as it does when the machine goes to sleep. */
    holdForSleep: (hold: NonNullable<typeof heldIdle>) => {
      heldIdle = hold;
      running = null;
    },
    /** The machine waking: main records the return and tells the renderer. */
    wake: () => {
      if (heldIdle && heldIdle.returnedAt === null) {
        heldIdle = { ...heldIdle, returnedAt: new Date(now()).toISOString() };
      }
      wakeListeners.forEach((listener) => listener());
    },
    idlePromptVisible: () => !document.getElementById('idle-prompt')!.hidden,
    autoStartNoticeVisible: () =>
      !document.getElementById('auto-start-notice')!.hidden,
    autoStartMessage: () =>
      document.getElementById('auto-start-message')!.textContent,
    clickAutoStartStop: () => document.getElementById('auto-start-stop')!.click(),
    clickAutoStartOk: () => document.getElementById('auto-start-ok')!.click(),
    /** The passing line above the timer — what it says, or null while hidden. */
    idleNotice: () => {
      const el = document.getElementById('idle-notice')!;
      return el.hidden ? null : el.textContent;
    },
    /** A timer appearing from somewhere else, started at a time of its own. */
    startElsewhereAt: (startedAt: string) => {
      running = { ...entry, id: `e${++entrySeq}`, startedAt };
    },
    /** Main losing its copy of the hold, as a stray poll's clear does. */
    dropHold: () => {
      heldIdle = null;
    },
    /** The renderer has applied a running timer. */
    rendererShowsRunning: () => document.getElementById('timer-card')!.classList.contains('is-running'),
    /**
     * Whether a Keep/Discard/wake restart is still finishing — the
     * renderer's own guard, through the probe `rendererScript` appends. A
     * status poll can show the timer running and clear the hold first, so
     * nothing on the page says the restart's own tail (totals, then
     * `setRunning`) is done.
     */
    idleRestartInFlight: () =>
      (window as unknown as { __idleRestartInFlight: () => boolean }).__idleRestartInFlight(),
    idleMessage: () => document.getElementById('idle-banner-message')!.textContent,
    /** The refusal line inside the idle question — what it says, or null while hidden. */
    idleError: () => {
      const el = document.getElementById('idle-error')!;
      return el.hidden ? null : el.textContent;
    },
    clickKeepIdle: () => document.getElementById('idle-keep-button')!.click(),
    clickDiscardIdle: () => document.getElementById('idle-discard-button')!.click(),
    advanceClock: (ms: number) => {
      clock.offsetMs += ms;
    },
    /** Main asking the renderer how a close should go. */
    requestClose: () => closeRequestListeners.forEach((listener) => listener()),
    closePromptVisible: () => !document.getElementById('close-prompt')!.hidden,
    /** A Project picked under the tray's "Recent projects". */
    trayTrackProject: (projectId: string) =>
      trayTrackProjectListeners.forEach((listener) => listener(projectId)),
    /** The tray menu's own Start/Stop timer item. */
    trayToggleTimer: () => trayToggleListeners.forEach((listener) => listener()),
    /** The tray's Sign out, after its confirmation. */
    traySignOut: () => traySignOutListeners.forEach((listener) => listener()),
    /** Main's signal that the window came back from the tray. */
    reopen: () => reopenListeners.forEach((listener) => listener()),
    remind: (message: string) =>
      reminderListeners.forEach((listener) => listener(message)),
    /** The server starts reporting a reached work limit from the next poll. */
    reportLimitReached: (limit: { kind: 'daily' | 'weekly'; limitHours: number }) => {
      server.limitReached = limit;
    },
    shrinkToSmallest: () => {
      document.getElementById('compact-button')!.click();
      document.getElementById('compact-shrink')!.click();
    },
    reminderVisible: () =>
      !document.getElementById('reminder-banner')!.hidden &&
      !document.getElementById('full-view')!.hidden,
    /** Same contract as `reminderVisible`: shown, and in the full window. */
    limitDialogVisible: () =>
      !document.getElementById('timer-blocked')!.hidden &&
      !document.getElementById('full-view')!.hidden,
    isRunning: () => running !== null,
    projectCount: () => document.getElementById('project-count')!.textContent,
    projectSectionsHidden: () =>
      document.getElementById('search-section')!.hidden &&
      document.getElementById('projects-section')!.hidden,
    taskTriggerHidden: () => document.getElementById('task-trigger')!.hidden,
    trackingName: () => document.getElementById('tracking-project-name')!.textContent,
    /** What the project row shows as tracked today. */
    projectTotal: (name: string) =>
      [...document.querySelectorAll('#project-list li')]
        .find((li) => li.textContent?.includes(name))
        ?.querySelector('.project-total')?.textContent ?? null,
    /** Time booked against a project from somewhere else — the web console. */
    addCompletedElsewhere: (projectId: string, durationSeconds: number) => {
      completed.push({
        id: `elsewhere-${completed.length + 1}`,
        projectId,
        durationSeconds,
      });
    },
    trackingError: () => {
      const el = document.getElementById('tracking-error')!;
      return el.hidden ? null : el.textContent;
    },
    syncStatus: () => document.getElementById('sync-status-label')!.textContent,
    visibleView: () =>
      [...document.querySelectorAll<HTMLElement>('#login-view, #status-view')].find(
        (el) => !el.hidden,
      )?.id,
    clickLogout: () => document.getElementById('logout-button')!.click(),
    clickPlay: () => document.getElementById('timer-toggle')!.click(),
    /** The toggle disables itself while a click is in flight and ignores clicks meanwhile. */
    playReady: () => !(document.getElementById('timer-toggle') as HTMLButtonElement).disabled,
    close: () => dom.window.close(),
  };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls rather than sleeping a fixed time, so a slow CI runner can't flake it. */
async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return; // let the assertions below report what's wrong
    await settle(10);
  }
}

/** Setup has finished: projects listed and the first status poll answered. */
async function waitForSetup(app: ReturnType<typeof launch>): Promise<void> {
  await waitFor(() => app.projectCount() !== '0' && app.calls.status > 0 && app.playReady());
}

/**
 * An idle restart has finished in the renderer, not just reached the
 * server. Closing the window on the server's word alone left the restart's
 * tail — the totals refresh, then `setRunning` — running against a
 * torn-down document, which CI reported as unhandled rejections.
 */
async function waitForIdleRestart(app: ReturnType<typeof launch>): Promise<void> {
  await waitFor(
    () =>
      app.isRunning() &&
      app.heldIdle() === null &&
      app.rendererShowsRunning() &&
      !app.idleRestartInFlight(),
  );
}

/** The timer never starts on its own — the person presses play. */
async function startTimer(app: ReturnType<typeof launch>): Promise<void> {
  await waitForSetup(app);
  app.clickPlay();
  await waitFor(() => app.isRunning() && app.playReady());
}

describe('renderer leaves the timer stopped at launch', () => {
  it('does not start the timer when the app opens', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);
    await settle(FAST_POLL_MS * 3);

    expect(app.calls.start).toBe(0);
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('starts only when play is pressed', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await startTimer(app);

    expect(app.calls.start).toBe(1);
    expect(app.isRunning()).toBe(true);
    app.close();
  });
});

describe('renderer starts the timer when the machine comes on', () => {
  it('starts on the Project play would have used, and says so', async () => {
    const app = launch({ failingProjectLoads: 0, autoStartDue: true });
    await waitFor(() => app.isRunning() && app.autoStartNoticeVisible());

    expect(app.calls.startedWith).toEqual([PROJECT.id]);
    expect(app.autoStartMessage()).toContain('Project One');
    app.close();
  });

  it('starts with no Project where the organisation has none', async () => {
    const app = launch({
      failingProjectLoads: 0,
      autoStartDue: true,
      projectsEnabled: false,
    });
    await waitFor(() => app.isRunning() && app.autoStartNoticeVisible());

    expect(app.calls.startedWith).toEqual([null]);
    expect(app.autoStartMessage()).toBe("You're now tracking time.");
    app.close();
  });

  it('offers one click to undo it', async () => {
    const app = launch({ failingProjectLoads: 0, autoStartDue: true });
    await waitFor(() => app.isRunning() && app.autoStartNoticeVisible());

    app.clickAutoStartStop();
    await waitFor(() => !app.isRunning() && app.playReady());

    expect(app.autoStartNoticeVisible()).toBe(false);
    expect(app.calls.timerNotices.at(-1)).toBe('Stopped timer for Project One');
    app.close();
  });

  it('dismisses with OK, leaving the timer running', async () => {
    const app = launch({ failingProjectLoads: 0, autoStartDue: true });
    await waitFor(() => app.autoStartNoticeVisible());

    app.clickAutoStartOk();

    expect(app.autoStartNoticeVisible()).toBe(false);
    expect(app.isRunning()).toBe(true);
    app.close();
  });

  it('says why in the notification shelf when it is refused, and opens nothing', async () => {
    const app = launch({ failingProjectLoads: 0, autoStartDue: true });
    app.server.refuseStarts = true;
    app.server.refuseStartStatus = 403;
    await waitFor(() => app.calls.timerNotices.length > 0);

    expect(app.calls.timerNotices[0]).toContain('did not start automatically');
    expect(app.calls.timerNotices[0]).toContain('daily limit');
    // Nobody clicked anything, so nothing is put in front of them.
    expect(app.autoStartNoticeVisible()).toBe(false);
    expect(app.limitDialogVisible()).toBe(false);
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('leaves a timer already running elsewhere alone', async () => {
    const app = launch({
      failingProjectLoads: 0,
      autoStartDue: true,
      runningElsewhere: true,
    });
    await waitForSetup(app);
    await settle(FAST_POLL_MS * 3);

    expect(app.calls.start).toBe(0);
    expect(app.autoStartNoticeVisible()).toBe(false);
    app.close();
  });

  it('lets an idle question found at launch be answered first', async () => {
    const app = launch({
      failingProjectLoads: 0,
      autoStartDue: true,
      idlePolicy: { handling: 'flag', thresholdMinutes: 20 },
      storedHold: {
        projectId: PROJECT.id,
        taskId: null,
        idleStartedAt: new Date(Date.now() - 90 * MINUTE_MS).toISOString(),
        returnedAt: null,
        reason: 'sleep',
      },
    });
    await waitFor(() => app.idlePromptVisible());
    await settle(FAST_POLL_MS * 3);

    expect(app.autoStartNoticeVisible()).toBe(false);
    expect(app.calls.start).toBe(0);
    // Asked all the same: main spends the power-on as it answers, so the
    // start this displaced cannot turn up at a sign-in hours later.
    expect(app.calls.autoStartDue).toBe(1);
    app.close();
  });

  // Autostart at OS login routinely beats the network up. Main is not
  // asked until the projects are in, so the start lands on the retry.
  it('still starts once a setup that failed at launch comes good', async () => {
    const app = launch({ failingProjectLoads: 1, autoStartDue: true });
    await waitFor(() => app.isRunning() && app.autoStartNoticeVisible());

    expect(app.calls.startedWith).toEqual([PROJECT.id]);
    app.close();
  });

  // Whatever reruns setup — a sign-in, a Projects setting flipping, the
  // retry above — gets one answer between them.
  it('starts once however often setup runs', async () => {
    const app = launch({ failingProjectLoads: 0, autoStartDue: true });
    await waitFor(() => app.isRunning() && app.autoStartNoticeVisible());
    app.clickAutoStartOk();

    app.trayToggleTimer();
    await waitFor(() => !app.isRunning());
    await settle(FAST_POLL_MS * 3);

    expect(app.calls.startedWith).toEqual([PROJECT.id]);
    expect(app.autoStartNoticeVisible()).toBe(false);
    app.close();
  });
});

describe('renderer tracking setup recovers from a failed first load', () => {
  it('loads projects once the server becomes reachable', async () => {
    const app = launch({ failingProjectLoads: 1 });
    await waitForSetup(app);

    expect(app.projectCount()).toBe('1');
    expect(app.isRunning()).toBe(false);
    expect(app.trackingError()).toBeNull();
    app.close();
  });

  it('keeps retrying through several failures', async () => {
    const app = launch({ failingProjectLoads: 4 });
    await waitForSetup(app);

    expect(app.projectCount()).toBe('1');
    app.close();
  });

  /**
   * An unreachable server is a supported state, not a fault
   * (docs/adr/0025-...): nothing has gone wrong and there is nothing for
   * the person to do, so the red line above the timer stays empty and the
   * sync line carries it instead. What must never come back is the
   * original bug this file exists for — reporting it as "No projects are
   * available", which blames the account for the network.
   */
  it('says it cannot reach Hi Day in the sync line, not as an error', async () => {
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY });
    await waitFor(() => app.calls.listProjects >= 2);

    expect(app.trackingError()).toBeNull();
    expect(app.syncStatus()).toContain("Can't reach Hi Day");
    expect(app.calls.start).toBe(0);
    app.close();
  });

  it('stops retrying once signed out', async () => {
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY });
    await settle(FAST_POLL_MS / 2);
    app.clickLogout();
    await settle(FAST_POLL_MS);
    const callsAtSignOut = app.calls.listProjects;
    await settle(FAST_POLL_MS * 6);

    expect(app.calls.listProjects).toBe(callsAtSignOut);
    expect(app.visibleView()).toBe('login-view');
    app.close();
  });

  it('does not stack status polling after recovering', async () => {
    const control = launch({ failingProjectLoads: 0 });
    const recovered = launch({ failingProjectLoads: 3 });
    await waitFor(() => recovered.calls.idlePolicy > 0 && control.calls.idlePolicy > 0);
    await settle(FAST_POLL_MS * 2);

    const controlBaseline = control.calls.status;
    const recoveredBaseline = recovered.calls.status;
    await settle(FAST_POLL_MS * 10);
    const controlRate = control.calls.status - controlBaseline;
    const recoveredRate = recovered.calls.status - recoveredBaseline;

    // One interval each — a duplicated interval would roughly double it.
    expect(recoveredRate).toBeLessThanOrEqual(controlRate + 2);
    expect(recovered.calls.idlePolicy).toBeGreaterThanOrEqual(1);
    control.close();
    recovered.close();
  });

  it('adopts a timer already running elsewhere instead of starting one', async () => {
    const app = launch({ failingProjectLoads: 2, runningElsewhere: true });
    await waitFor(() => app.projectCount() === '1' && app.calls.status > 0);
    await settle(FAST_POLL_MS);

    expect(app.projectCount()).toBe('1');
    expect(app.calls.start).toBe(0);
    app.close();
  });

  it('shows the not-tracking reminder even from the smallest view', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitFor(() => app.calls.status > 0 && app.playReady());
    app.shrinkToSmallest();

    app.remind('You have not started tracking — 10 minutes untracked.');

    expect(app.reminderVisible()).toBe(true);
    app.close();
  });

  it('shows the work-limit dialog at full size even from the smallest view', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitFor(() => app.calls.status > 0 && app.playReady());
    app.shrinkToSmallest();

    app.reportLimitReached({ kind: 'daily', limitHours: 8 });
    await waitFor(() => app.limitDialogVisible());

    expect(app.limitDialogVisible()).toBe(true);
    app.close();
  });

  it('still says "No projects" when the account genuinely has none', async () => {
    const app = launch({ failingProjectLoads: 0, projects: [] });
    await waitFor(() => app.calls.status > 0 && app.playReady());
    app.clickPlay();
    await waitFor(() => app.trackingError() !== null);

    expect(app.trackingError()).toBe('No projects are available to track time against.');
    app.close();
  });
});

describe('renderer idle policy', () => {
  it('refetches the idle policy on a later poll when the first load failed', async () => {
    const app = launch({ failingProjectLoads: 0, failingIdlePolicyLoads: 1 });
    await waitFor(() => app.calls.idlePolicy >= 2);

    expect(app.calls.idlePolicy).toBeGreaterThanOrEqual(2);
    app.close();
  });

  it('stops refetching once the idle policy has loaded', async () => {
    const app = launch({ failingProjectLoads: 0, failingIdlePolicyLoads: 1 });
    await waitFor(() => app.calls.idlePolicy >= 2);
    const callsOnceLoaded = app.calls.idlePolicy;
    await settle(FAST_POLL_MS * 6);

    expect(app.calls.idlePolicy).toBe(callsOnceLoaded);
    app.close();
  });
});

describe('renderer asks for login before the timer can start on an ended session', () => {
  it('shows the login view at launch instead of starting the timer', async () => {
    const app = launch({ failingProjectLoads: 0 });
    app.server.revoked = true;
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('shows the login view when play is pressed after the session ended', async () => {
    // Long poll: nothing but the click itself can discover the sign-out.
    const app = launch({ failingProjectLoads: 0, pollMs: 60_000 });
    await startTimer(app);
    app.clickPlay(); // pause
    await waitFor(() => !app.isRunning() && app.playReady());
    app.server.revoked = true;
    app.clickPlay();
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('checks the session when play is pressed while projects never loaded', async () => {
    // Long poll: the scheduled retry won't fire, so the click must reach the server.
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY, pollMs: 60_000 });
    await waitFor(() => app.trackingError() !== null);
    app.server.revoked = true;
    app.clickPlay();
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.trackingError()).toBeNull();
    app.close();
  });

  it('starts the timer when play is pressed once the server is reachable again', async () => {
    const app = launch({ failingProjectLoads: 1, pollMs: 60_000 });
    await waitFor(() => app.trackingError() !== null);
    app.clickPlay();
    await waitFor(() => app.isRunning());

    expect(app.projectCount()).toBe('1');
    expect(app.isRunning()).toBe(true);
    app.close();
  });
});

describe("renderer picks up time added elsewhere", () => {
  it("adds it to the project it belongs to, without a restart", async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitFor(() => app.projectTotal('Project One') !== null);
    expect(app.projectTotal('Project One')).toBe('0:00');

    // An admin adds an hour to this project from the web console.
    app.addCompletedElsewhere('p1', 3600);

    await waitFor(() => app.projectTotal('Project One') === '1:00');
    app.close();
  });

});

describe('renderer timer runs on the local clock', () => {
  /** Lets a few status polls land, each of which could overwrite the display. */
  const letPollsRun = async (app: ReturnType<typeof launch>) => {
    const polls = app.calls.status;
    await waitFor(() => app.calls.status >= polls + 3);
  };

  it('resumes from where it stopped instead of jumping to the server time', async () => {
    const app = launch({ failingProjectLoads: 0, serverShortfallSeconds: 20 });
    await startTimer(app);

    app.advanceClock(100_000);
    await letPollsRun(app);
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(100);
    expect(app.timerSeconds()).toBeLessThanOrEqual(101);

    app.clickPlay(); // stop
    await waitFor(() => !app.isRunning() && app.playReady());
    const stoppedAt = app.timerSeconds();
    expect(stoppedAt).toBeGreaterThanOrEqual(100);

    // Stopped: neither the clock nor the server's shorter count moves it.
    app.advanceClock(30_000);
    await letPollsRun(app);
    expect(app.timerSeconds()).toBe(stoppedAt);

    app.clickPlay(); // start again
    await waitFor(() => app.isRunning() && app.playReady());
    expect(app.timerSeconds()).toBe(stoppedAt);

    app.advanceClock(10_000);
    await letPollsRun(app);
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(stoppedAt + 10);
    expect(app.timerSeconds()).toBeLessThanOrEqual(stoppedAt + 11);
    app.close();
  });

  it('does not count time spent stopped once the timer starts again', async () => {
    // Long poll: no status poll lands between stop and start to hide a stale baseline.
    const app = launch({ failingProjectLoads: 0, pollMs: 60_000 });
    await startTimer(app);
    app.advanceClock(100_000);
    app.clickPlay(); // stop
    await waitFor(() => !app.isRunning() && app.playReady());
    const stoppedAt = app.timerSeconds();

    app.advanceClock(30_000);
    app.clickPlay(); // start again
    await waitFor(() => app.isRunning() && app.playReady());

    expect(app.timerSeconds()).toBe(stoppedAt);
    app.close();
  });

  it("re-reads the day's time from the server when the window is reopened", async () => {
    const app = launch({ failingProjectLoads: 0, serverShortfallSeconds: 20 });
    await startTimer(app);
    app.advanceClock(100_000);
    app.clickPlay(); // stop: the server books 80s, the device shows 100s
    await waitFor(() => !app.isRunning() && app.playReady());
    await letPollsRun(app);
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(100);

    app.reopen();
    await waitFor(() => app.timerSeconds() < 100);

    expect(app.timerSeconds()).toBe(80);
    app.close();
  });
});

describe('renderer close prompt', () => {
  it('asks before closing while signed in', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitFor(() => app.visibleView() === 'status-view');
    app.requestClose();

    expect(app.closePromptVisible()).toBe(true);
    app.close();
  });

  it('still asks after signing out', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitFor(() => app.visibleView() === 'status-view');
    app.clickLogout();
    await waitFor(() => app.visibleView() === 'login-view');
    app.requestClose();

    expect(app.closePromptVisible()).toBe(true);
    app.close();
  });
});

describe('renderer takes the tray menu', () => {
  const OTHER = { ...PROJECT, id: 'p2', name: 'Project Two' };

  // Clicking the running Project's row pauses it; a menu item that reads
  // as "track this" must not.
  it.each([
    ['the play button', (app: ReturnType<typeof launch>) => app.clickPlay()],
    ['the tray menu', (app: ReturnType<typeof launch>) => app.trayToggleTimer()],
  ])('confirms a start and a stop made from %s', async (_label, toggle) => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);

    toggle(app);
    await waitFor(() => app.isRunning() && app.playReady());
    toggle(app);
    await waitFor(() => !app.isRunning() && app.playReady());

    expect(app.calls.timerNotices).toEqual([
      'Started timer for Project One',
      'Stopped timer for Project One',
    ]);
    app.close();
  });

  it('starts from the tray without raising the window, and says so', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);
    const raisedBefore = app.calls.shows;

    app.trayToggleTimer();
    await waitFor(() => app.isRunning() && app.playReady());

    expect(app.calls.timerNotices).toEqual(['Started timer for Project One']);
    // The point of the tray item: it does not drag the window back.
    expect(app.calls.shows).toBe(raisedBefore);
    app.close();
  });

  it('stops from the tray the same way, naming what it stopped', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await startTimer(app);
    const raisedBefore = app.calls.shows;

    app.trayToggleTimer();
    await waitFor(() => !app.isRunning() && app.playReady());

    // The play button that started it said so too; this is the last word.
    expect(app.calls.timerNotices.at(-1)).toBe('Stopped timer for Project One');
    expect(app.calls.shows).toBe(raisedBefore);
    app.close();
  });

  it('names no Project where the organisation has none', async () => {
    const app = launch({ failingProjectLoads: 0, projectsEnabled: false });
    await waitFor(() => app.calls.status > 0 && app.playReady());

    app.trayToggleTimer();
    await waitFor(() => app.isRunning() && app.playReady());

    expect(app.calls.timerNotices).toEqual(['Started timer']);
    app.close();
  });

  it('claims nothing and comes forward when the tray start is refused', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);
    const raisedBefore = app.calls.shows;
    app.server.refuseStarts = true;

    app.trayToggleTimer();
    await waitFor(() => app.trackingError() !== null);

    expect(app.calls.timerNotices).toEqual([]);
    // A refusal in a window nobody can see is a refusal nobody reads.
    expect(app.calls.shows).toBeGreaterThan(raisedBefore);
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('keeps tracking when the running Project is picked from the tray', async () => {
    const app = launch({ failingProjectLoads: 0, projects: [PROJECT, OTHER] });
    await startTimer(app);

    app.trayTrackProject(PROJECT.id);
    await settle(FAST_POLL_MS * 2);

    expect(app.calls.pause).toBe(0);
    expect(app.isRunning()).toBe(true);
    app.close();
  });

  it('switches to another Project picked from the tray', async () => {
    const app = launch({ failingProjectLoads: 0, projects: [PROJECT, OTHER] });
    await startTimer(app);

    app.trayTrackProject(OTHER.id);
    await waitFor(() => app.calls.switchedTo.length > 0);

    expect(app.calls.switchedTo).toEqual([OTHER.id]);
    app.close();
  });

  it('starts on a Project picked from the tray while stopped', async () => {
    const app = launch({ failingProjectLoads: 0, projects: [PROJECT, OTHER] });
    await waitForSetup(app);

    app.trayTrackProject(OTHER.id);
    await waitFor(() => app.isRunning());

    expect(app.calls.startedWith).toEqual([OTHER.id]);
    app.close();
  });

  it('ignores a Project the list no longer has', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);

    app.trayTrackProject('archived');
    await settle(FAST_POLL_MS * 2);

    expect(app.calls.start).toBe(0);
    app.close();
  });

  it('lands on the login view after signing out from the tray', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);

    app.traySignOut();
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    app.close();
  });
});

describe('renderer with Projects turned off', () => {
  /** There is no list to wait on, so setup is the first status poll answering. */
  async function waitForSetupWithoutProjects(app: ReturnType<typeof launch>): Promise<void> {
    await waitFor(() => app.calls.status > 0 && app.playReady());
  }

  it('hides the project list, search and task picker', async () => {
    const app = launch({ failingProjectLoads: 0, projectsEnabled: false });
    await waitForSetupWithoutProjects(app);

    expect(app.projectSectionsHidden()).toBe(true);
    expect(app.taskTriggerHidden()).toBe(true);
    expect(app.calls.listProjects).toBe(0);
    app.close();
  });

  it('starts a timer with no project when play is pressed', async () => {
    const app = launch({ failingProjectLoads: 0, projectsEnabled: false });
    await waitForSetupWithoutProjects(app);
    app.clickPlay();
    await waitFor(() => app.isRunning() && app.playReady());

    expect(app.calls.startedWith).toEqual([null]);
    expect(app.isRunning()).toBe(true);
    expect(app.trackingError()).toBeNull();
    app.close();
  });

  it('still shows the list and starts on a project when they are on', async () => {
    const app = launch({ failingProjectLoads: 0 });
    await startTimer(app);

    expect(app.projectSectionsHidden()).toBe(false);
    expect(app.calls.startedWith).toEqual([PROJECT.id]);
    app.close();
  });

  it('names a timer that still carries an old project "Tracking time", never its id', async () => {
    const app = launch({
      failingProjectLoads: 0,
      projectsEnabled: false,
      runningElsewhere: true,
    });
    await waitFor(() => app.isRunning() && !!app.trackingName());

    expect(app.trackingName()).toBe('Tracking time');
    app.close();
  });
});

const MINUTE_MS = 60_000;
/** Whole seconds — the renderer works in them, so a test should too. */
const secondsOf = (iso: string | undefined) => Math.round(Date.parse(iso ?? '') / 1000);

/**
 * The ticket: tracking stopped before the idle timeout was reached. Before
 * it, nothing may happen at all; at it, tracking stops where input stopped
 * and waits for Keep or Discard.
 */
describe('renderer idle timeout', () => {
  const flag20 = { handling: 'flag' as const, thresholdMinutes: 20 };

  it('keeps tracking when the person comes back before the timeout', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);

    app.setIdleSeconds(19 * 60);
    await settle(FAST_POLL_MS * 4);
    app.setIdleSeconds(2);
    await settle(FAST_POLL_MS * 4);

    expect(app.calls.stoppedAt).toEqual([]);
    expect(app.idlePromptVisible()).toBe(false);
    expect(app.isRunning()).toBe(true);
    app.close();
  });

  it.each([5, 20])(
    'with a %i min timeout, stops where input stopped and asks only once it is reached',
    async (thresholdMinutes) => {
      const app = launch({ failingProjectLoads: 0, idlePolicy: { handling: 'flag', thresholdMinutes } });
      await startTimer(app);

      app.setIdleSeconds(thresholdMinutes * 60 - 30);
      await settle(FAST_POLL_MS * 4);
      expect(app.idlePromptVisible()).toBe(false);

      app.setIdleSeconds(thresholdMinutes * 60);
      await waitFor(() => app.idlePromptVisible());

      expect(app.isRunning()).toBe(false);
      expect(app.calls.stoppedAt).toHaveLength(1);
      const expectedStop = Math.round(Date.now() / 1000) - thresholdMinutes * 60;
      expect(Math.abs(secondsOf(app.calls.stoppedAt[0]) - expectedStop)).toBeLessThanOrEqual(2);
      expect(app.heldIdle()?.reason).toBe('timeout');
      app.close();
    },
  );

  it('Keep starts again from where input stopped, so the idle time counts once', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.clickKeepIdle();
    await waitForIdleRestart(app);

    expect(app.calls.startedAt.at(-1)).toBe(app.calls.stoppedAt[0]);
    expect(app.idlePromptVisible()).toBe(false);
    expect(app.heldIdle()).toBeNull();
    app.close();
  });

  it('Discard starts again from when the person came back, keeping the work done before answering', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(25 * 60);
    await waitFor(() => app.idlePromptVisible());

    // Back at the keyboard 10 seconds ago, then a minute before answering.
    app.setIdleSeconds(10);
    await waitFor(() => app.heldIdle()?.returnedAt !== null);
    const returnedAt = app.heldIdle()!.returnedAt!;
    app.advanceClock(MINUTE_MS);
    app.clickDiscardIdle();
    await waitForIdleRestart(app);

    expect(app.calls.startedAt.at(-1)).toBe(returnedAt);
    expect(secondsOf(returnedAt) - secondsOf(app.calls.stoppedAt[0])).toBeGreaterThanOrEqual(25 * 60 - 12);
    app.close();
  });

  it('keeps the question open when the restart is refused, so the idle time is not lost', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.server.refuseStarts = true;
    app.clickKeepIdle();
    await waitFor(() => app.idleError() !== null);

    expect(app.idlePromptVisible()).toBe(true);
    expect(app.heldIdle()).not.toBeNull();
    // Inside the question, not over it and not behind it: the red line
    // above the timer sits under the question's own layer, so a refusal
    // sent there leaves Keep looking like a dead button.
    expect(app.idleError()).toContain('daily limit');
    expect(app.trackingError()).toBeNull();

    app.server.refuseStarts = false;
    app.clickDiscardIdle();
    await waitForIdleRestart(app);
    expect(app.heldIdle()).toBeNull();
    expect(app.idlePromptVisible()).toBe(false);
    app.close();
  });

  it('keeps them on the clock when the restart was queued offline', async () => {
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      pollMs: 60_000,
      idlePollMs: FAST_POLL_MS,
    });
    await startTimer(app);
    app.advanceClock(40 * MINUTE_MS);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    // No connection: the start is queued, and anything `status` says is the
    // cache's projection of a figure that belongs to the entry just ended.
    app.server.queueStarts = true;
    app.server.workedSecondsOverride = 0;
    app.clickKeepIdle();
    await waitForIdleRestart(app);

    // Still the full forty minutes: the stale figure must not be allowed
    // to overwrite one this device can work out exactly.
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(40 * 60 - 2);
    app.close();
  });

  it('leaves the discarded minutes off it, on the same instant', async () => {
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      pollMs: 60_000,
      idlePollMs: FAST_POLL_MS,
    });
    await startTimer(app);
    app.advanceClock(40 * MINUTE_MS);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());
    // Back at the keyboard ten seconds ago.
    app.setIdleSeconds(10);
    await waitFor(() => app.heldIdle()?.returnedAt !== null);

    app.clickDiscardIdle();
    await waitForIdleRestart(app);

    // The twenty minutes worked before going idle, and nothing for the
    // twenty spent away — the mirror of Keep, on the same code path.
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(20 * 60);
    expect(app.timerSeconds()).toBeLessThanOrEqual(20 * 60 + 30);
    app.close();
  });

  it('puts the kept minutes on the clock, not only on the server', async () => {
    // Long poll: nothing lands to re-seed the clock from the server, so
    // what the person sees is what the restart itself left behind.
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      pollMs: 60_000,
      idlePollMs: FAST_POLL_MS,
    });
    await startTimer(app);
    app.advanceClock(40 * MINUTE_MS);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.clickKeepIdle();
    await waitForIdleRestart(app);

    // Forty minutes tracked, twenty of them idle and kept: all of it still
    // on the clock. It used to count the new entry from "now", so the
    // twenty minutes Keep was pressed to keep vanished off the display.
    expect(app.timerSeconds()).toBeGreaterThanOrEqual(40 * 60 - 2);
    expect(app.timerSeconds()).toBeLessThanOrEqual(40 * 60 + 2);
    app.close();
  });

  it('says a refused answer inside the question rather than in a dialog over it', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.server.refuseStarts = true;
    app.server.refuseStartStatus = 403;
    app.clickKeepIdle();
    await waitFor(() => app.idleError() !== null);

    expect(app.limitDialogVisible()).toBe(false);
    expect(app.idlePromptVisible()).toBe(true);
    expect(app.heldIdle()).not.toBeNull();
    app.close();
  });

  it('a held stretch survives a relaunch: the prompt comes back', async () => {
    const idleStartedAt = new Date(Date.now() - 30 * MINUTE_MS).toISOString();
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      storedHold: { projectId: PROJECT.id, taskId: null, idleStartedAt, returnedAt: null, reason: 'timeout' },
    });
    await waitFor(() => app.idlePromptVisible());

    expect(app.calls.start).toBe(0);
    expect(app.heldIdle()?.returnedAt).not.toBeNull();
    app.close();
  });
});

/**
 * The bug as reported: the not-tracking reminder landed on top of the open
 * idle question, and the time the question was holding was gone afterwards.
 */
describe('renderer asks one question at a time', () => {
  const flag20 = { handling: 'flag' as const, thresholdMinutes: 20 };

  it('drops the not-tracking reminder while the idle question is open', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.remind('You have not tracked time in 10 minutes.');
    await settle(FAST_POLL_MS);

    expect(app.reminderVisible()).toBe(false);
    expect(app.idlePromptVisible()).toBe(true);
    app.close();
  });

  it.each([
    ['the tray menu\'s Start timer', (app: ReturnType<typeof launch>) => app.trayToggleTimer()],
    ['a Project picked from the tray', (app: ReturnType<typeof launch>) => app.trayTrackProject(PROJECT.id)],
    ['the play button', (app: ReturnType<typeof launch>) => app.clickPlay()],
  ])('takes the reminder down when tracking starts from %s', async (_label, start) => {
    const app = launch({ failingProjectLoads: 0 });
    await waitForSetup(app);
    app.remind('You have not tracked time in 10 minutes.');
    expect(app.reminderVisible()).toBe(true);

    start(app);
    await waitFor(() => app.isRunning() && app.playReady());

    // It used to come down only for its own two buttons, so starting from
    // the tray left it over the window — and over the idle question when
    // that arrived underneath it.
    expect(app.reminderVisible()).toBe(false);
    app.close();
  });

  it('takes it down when the idle question needs the screen', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    // Up before the question: a nudge that was already on screen when the
    // timeout landed must not be left on top of it.
    app.remind('You have not tracked time in 10 minutes.');
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    expect(app.reminderVisible()).toBe(false);
    app.close();
  });

  it('nudges again as usual once the question is answered', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());
    app.clickDiscardIdle();
    await waitForIdleRestart(app);

    app.remind('You have not tracked time in 10 minutes.');

    expect(app.reminderVisible()).toBe(true);
    app.close();
  });

  it('keeps the hold stored for as long as the question is on screen', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    // The refused restart re-asks; main's copy went in the meantime, as a
    // status poll landing mid-restart used to clear it. A question with no
    // hold behind it is what let the reminder through on top of it.
    app.server.refuseStarts = true;
    app.dropHold();
    app.clickKeepIdle();
    await waitFor(() => app.trackingError() !== null);

    expect(app.idlePromptVisible()).toBe(true);
    expect(app.heldIdle()).not.toBeNull();
    app.close();
  });

  it('says so when a timer started elsewhere leaves the idle time uncounted', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(25 * 60);
    await waitFor(() => app.idlePromptVisible());
    // Back at the keyboard — whoever starts a timer is.
    app.setIdleSeconds(2);
    await waitFor(() => app.heldIdle()?.returnedAt !== null);

    // Started from the tray while the question sits unanswered: the idle
    // stretch cannot be kept now, so the person is told it was not.
    app.trayTrackProject(PROJECT.id);
    await waitFor(() => !app.idlePromptVisible());

    expect(app.idleNotice()).toContain('not counted');
    expect(app.idleNotice()).toMatch(/2[45] min idle/);
    expect(app.heldIdle()).toBeNull();
    app.close();
  });

  it('says nothing of the sort when the timer that turned up covers the idle time', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(25 * 60);
    await waitFor(() => app.idlePromptVisible());
    const idleStartedAt = app.heldIdle()!.idleStartedAt;
    app.setIdleSeconds(2);
    await waitFor(() => app.heldIdle()?.returnedAt !== null);

    // An entry reaching back over the held stretch — a backdated start
    // from the web, or an answer whose reply was lost coming back. The
    // time is inside it, so nothing went uncounted.
    app.startElsewhereAt(idleStartedAt);
    await waitFor(() => !app.idlePromptVisible());

    expect(app.idleNotice()).toBeNull();
    expect(app.heldIdle()).toBeNull();
    app.close();
  });

  it('says nothing of the sort when Keep itself is what started the timer', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.setIdleSeconds(20 * 60);
    await waitFor(() => app.idlePromptVisible());

    app.clickKeepIdle();
    await waitForIdleRestart(app);

    expect(app.idleNotice()).toBeNull();
    app.close();
  });
});

/** The bug as reported: GNOME suspends a laptop after 15 min on battery, inside a 20 min timeout. */
describe('renderer after the machine sleeps', () => {
  const flag20 = { handling: 'flag' as const, thresholdMinutes: 20 };
  const sleptAt = (minutesAgo: number) => new Date(Date.now() - minutesAgo * MINUTE_MS).toISOString();

  it('picks tracking up from where input stopped when woken inside the timeout', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    const idleStartedAt = sleptAt(17);
    app.holdForSleep({ projectId: PROJECT.id, taskId: null, idleStartedAt, returnedAt: null, reason: 'sleep' });

    app.wake();
    await waitForIdleRestart(app);

    expect(app.calls.startedAt.at(-1)).toBe(idleStartedAt);
    expect(app.idlePromptVisible()).toBe(false);
    expect(app.heldIdle()).toBeNull();
    app.close();
  });

  it('asks when woken past the timeout, saying the computer was asleep', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    const idleStartedAt = sleptAt(90);
    app.holdForSleep({ projectId: PROJECT.id, taskId: null, idleStartedAt, returnedAt: null, reason: 'sleep' });

    app.wake();
    await waitFor(() => app.idlePromptVisible());

    expect(app.isRunning()).toBe(false);
    expect(app.idleMessage()).toContain('asleep');
    app.clickKeepIdle();
    await waitForIdleRestart(app);
    expect(app.calls.startedAt.at(-1)).toBe(idleStartedAt);
    app.close();
  });

  it('asks after a wake the status read could not survive', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.holdForSleep({
      projectId: PROJECT.id,
      taskId: null,
      idleStartedAt: sleptAt(90),
      returnedAt: null,
      reason: 'sleep',
    });

    // Woken somewhere with no usable network: the read that normally runs
    // first throws, and the question used to go with it.
    app.server.statusThrows = true;
    app.wake();
    await waitFor(() => app.idlePromptVisible());

    expect(app.idlePromptVisible()).toBe(true);
    expect(app.heldIdle()).not.toBeNull();
    app.close();
  });

  it('asks when the window comes back, for a wake the OS never reported', async () => {
    const app = launch({ failingProjectLoads: 0, idlePolicy: flag20 });
    await startTimer(app);
    app.holdForSleep({
      projectId: PROJECT.id,
      taskId: null,
      idleStartedAt: sleptAt(90),
      returnedAt: null,
      reason: 'sleep',
    });

    // No `wake()` at all — just the person opening the window again.
    app.reopen();
    await waitFor(() => app.idlePromptVisible());

    expect(app.idlePromptVisible()).toBe(true);
    app.close();
  });

  it('settles a sleep hold found at launch the same way', async () => {
    const idleStartedAt = sleptAt(3);
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      storedHold: {
        projectId: PROJECT.id,
        taskId: null,
        idleStartedAt,
        returnedAt: new Date().toISOString(),
        reason: 'sleep',
      },
    });
    await waitForIdleRestart(app);

    expect(app.calls.startedAt).toEqual([idleStartedAt]);
    app.close();
  });

  it('leaves a timer started elsewhere alone and drops the stale hold', async () => {
    const app = launch({
      failingProjectLoads: 0,
      idlePolicy: flag20,
      runningElsewhere: true,
      storedHold: { projectId: PROJECT.id, taskId: null, idleStartedAt: sleptAt(3), returnedAt: null, reason: 'sleep' },
    });
    await waitForSetup(app);
    await waitFor(() => app.heldIdle() === null);

    expect(app.calls.start).toBe(0);
    app.close();
  });
});

