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

function rendererScript(pollMs: number): string {
  const source = readFileSync(join(RENDERER_DIR, 'renderer.ts'), 'utf8');
  const fastSource = source.replace(
    'const STATUS_POLL_INTERVAL_MS = 15_000;',
    `const STATUS_POLL_INTERVAL_MS = ${pollMs};`,
  );
  // Guards the guard: a renamed constant would silently keep the 15s cadence.
  expect(fastSource).not.toBe(source);
  return ts
    .transpileModule(fastSource, {
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
  /** How far the server's count of each entry falls short of this device's clock. */
  serverShortfallSeconds?: number;
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

  const calls = { listProjects: 0, start: 0, status: 0, idlePolicy: 0 };
  const entry = {
    id: 'e1',
    projectId: PROJECT.id,
    taskId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
  };
  let running: typeof entry | null = scenario.runningElsewhere ? entry : null;
  let entrySeq = 1;
  const reopenListeners: (() => void)[] = [];
  const closeRequestListeners: (() => void)[] = [];
  const completed: {
    id: string;
    projectId: string;
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
  /** Flip `revoked` mid-test to sign the device out server-side. */
  const server = { revoked: false };
  const ok = <T>(data: T) =>
    Promise.resolve(server.revoked ? SIGNED_OUT : { ok: true, data });

  window.api = {
    getStatus: () =>
      Promise.resolve({ loggedIn: true, email: 'a@b.c', name: 'A', organisationName: 'Org' }),
    auth: {
      startPairing: () => ok({}),
      pairingStatus: () => Promise.resolve({ status: 'pending' }),
    },
    logout: () => Promise.resolve({ loggedIn: false }),
    tracking: {
      listProjects: () => {
        calls.listProjects += 1;
        if (!server.revoked && calls.listProjects <= scenario.failingProjectLoads) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok(scenario.projects ?? [PROJECT]);
      },
      listTasks: () => ok({ tasks: [] }),
      start: () => {
        calls.start += 1;
        const started = {
          ...entry,
          id: `e${++entrySeq}`,
          startedAt: new Date(now()).toISOString(),
        };
        if (!server.revoked) running = started;
        return ok(started);
      },
      switchTo: () => ok(entry),
      stop: () => ok(entry),
      status: () => {
        calls.status += 1;
        return ok({
          entry: running,
          now: new Date(now()).toISOString(),
          workedSeconds: serverWorkedSeconds(),
        });
      },
      // Pausing ends the entry, as the backend does now.
      pause: () => {
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
      entriesBetween: () => ok(completed),
      idlePolicy: () => {
        calls.idlePolicy += 1;
        if (!server.revoked && calls.idlePolicy <= (scenario.failingIdlePolicyLoads ?? 0)) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok({ handling: 'ignore', thresholdMinutes: 5 });
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
    idle: { seconds: () => Promise.resolve(0) },
    urlCapture: { timerStateChanged: () => {} },
    windowControls: {
      minimise: async () => {},
      show: async () => {},
      close: async () => {},
      setCompact: async () => {},
      onTrackingNotice: () => {},
      onTrackingReminder: () => {},
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

  window.eval(rendererScript(scenario.pollMs ?? FAST_POLL_MS));

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
    advanceClock: (ms: number) => {
      clock.offsetMs += ms;
    },
    /** Main asking the renderer how a close should go. */
    requestClose: () => closeRequestListeners.forEach((listener) => listener()),
    closePromptVisible: () => !document.getElementById('close-prompt')!.hidden,
    /** Main's signal that the window came back from the tray. */
    reopen: () => reopenListeners.forEach((listener) => listener()),
    isRunning: () => running !== null,
    projectCount: () => document.getElementById('project-count')!.textContent,
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

  it('shows the real error while waiting, not "No projects are available"', async () => {
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY });
    await waitFor(() => app.calls.listProjects >= 2);

    expect(app.trackingError()).toContain('Could not reach the server');
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
